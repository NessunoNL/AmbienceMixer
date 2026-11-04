import { GainEnvelope, level, seconds, TRANSITIONS } from './transitions';

export interface StreamSpec { key: string; url: string; volume: number; loop: boolean; restart?: boolean; }
interface Voice {
  channel: Channel;
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode;
  node: GainNode;
  envelope: GainEnvelope;
  url: string;
  loop: boolean;
  disposed: boolean;
  cleanup?: ReturnType<typeof setTimeout>;
  onEnded?: () => void;
  onError: () => void;
}
interface Channel {
  key: string;
  node: GainNode;
  gain: GainEnvelope;
  transportNode: GainNode;
  transport: GainEnvelope;
  volume: number;
  volumeRevision: number;
  paused: boolean;
  transportRevision: number;
  pauseTimer?: ReturnType<typeof setTimeout>;
  current?: Voice;
  voices: Set<Voice>;
  standby?: Voice;
  loopController?: AbortController;
  loopAttempt?: Voice;
  loopStarting?: Voice;
}

interface Preload {
  spec: StreamSpec;
  controller: AbortController;
  promise: Promise<Voice>;
  voice?: Voice;
}

/** All streams, including tails and one-shots, feed the same master bus. */
export class StreamMixer {
  readonly context: AudioContext;
  private master: GainNode;
  private masterGain: GainEnvelope;
  private channels = new Map<string, Channel>();
  private pending = new Map<string, AbortController>();
  private voices = new Set<Voice>();
  private preloads = new Map<string, Preload>();
  private loopTimer?: ReturnType<typeof setInterval>;
  private disposed = false;
  private unlocked = false;
  private shotIndex = 0;
  private shots: string[] = [];
  onError: (error: unknown) => void = error => console.error('Audio playback failed:', error);

  constructor(context = new AudioContext()) {
    this.context = context;
    this.master = context.createGain();
    this.masterGain = new GainEnvelope(context, this.master.gain, 1);
    this.master.connect(context.destination);
  }

  /** Call from a user gesture. Constructing/restoring state never starts audio. */
  async resume() {
    if (this.disposed) throw new Error('Audio engine is disposed');
    await this.context.resume();
    if (this.context.state !== 'running') throw new Error('Audio could not start; tap to try again');
    this.unlocked = true;
    this.loopTimer ??= setInterval(() => this.checkLoops(), 50);
  }

  private channel(key: string) {
    let channel = this.channels.get(key);
    if (!channel) {
      const node = this.context.createGain();
      const transportNode = this.context.createGain();
      node.connect(transportNode); transportNode.connect(this.master);
      channel = { key, node, transportNode, gain: new GainEnvelope(this.context, node.gain, 1),
        transport: new GainEnvelope(this.context, transportNode.gain, 1), volume: 1, volumeRevision: 0,
        paused: false, transportRevision: 0, voices: new Set() };
      this.channels.set(key, channel);
    }
    return channel;
  }

  private async prepare(channel: Channel, spec: StreamSpec, signal: AbortSignal, play = true): Promise<Voice> {
    const audio = new Audio(spec.url);
    // Keep media attached for embedded/mobile browser lifecycle handling.
    if (typeof document !== 'undefined') {
      audio.hidden = true;
      audio.setAttribute('aria-hidden', 'true');
      document.body.append(audio);
    }
    audio.preload = 'auto';
    audio.loop = spec.loop; // Fallback if overlap preparation cannot complete.
    const source = this.context.createMediaElementSource(audio);
    const node = this.context.createGain();
    const voice: Voice = { channel, audio, source, node, envelope: new GainEnvelope(this.context, node.gain, 0),
      url: spec.url, loop: spec.loop, disposed: false, onError: () => this.onError(new Error(`Audio stream failed: ${spec.url}`)) };
    source.connect(node); node.connect(channel.node);
    this.voices.add(voice);
    try {
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: unknown) => {
          clearTimeout(timeout);
          signal.removeEventListener('abort', abort);
          audio.removeEventListener('canplay', ready);
          audio.removeEventListener('error', failed);
          if (error) reject(error); else resolve();
        };
        const abort = () => finish(new DOMException('Playback superseded', 'AbortError'));
        const failed = () => finish(new Error(`Cannot load audio: ${spec.url}`));
        let playing = !play;
        const ready = () => { if (audio.readyState >= 3 && playing) finish(); };
        const timeout = setTimeout(() => finish(new Error(`Audio load timed out: ${spec.url}`)), TRANSITIONS.loadTimeout);
        signal.addEventListener('abort', abort, { once: true });
        audio.addEventListener('canplay', ready);
        audio.addEventListener('error', failed, { once: true });
        if (signal.aborted) { abort(); return; }
        if (play) void audio.play().then(() => { playing = true; ready(); }, finish);
        else audio.load();
        ready();
      });
      if (signal.aborted || this.disposed) throw new DOMException('Playback superseded', 'AbortError');
      audio.addEventListener('error', voice.onError);
      return voice;
    } catch (error) {
      this.cleanup(voice, channel);
      throw error;
    }
  }

  /** Load one silent, paused candidate without changing the active channel. */
  preload(spec: StreamSpec): Promise<void> {
    if (!this.unlocked || this.disposed) return Promise.reject(new Error('Start audio with a user gesture first'));
    const existing = this.preloads.get(spec.key);
    if (existing?.spec.url === spec.url && existing.spec.loop === spec.loop) return existing.promise.then(() => {});
    this.cancelPreload(spec.key);
    const channel = this.channel(spec.key);
    const controller = new AbortController();
    const preload: Preload = { spec, controller, promise: this.prepare(channel, spec, controller.signal, false) };
    this.preloads.set(spec.key, preload);
    preload.promise = preload.promise.then(voice => { preload.voice = voice; return voice; }).catch(error => {
      if (this.preloads.get(spec.key) === preload) this.preloads.delete(spec.key);
      this.dropIdle(channel);
      throw error;
    });
    return preload.promise.then(() => {});
  }

  cancelPreload(key: string) {
    const preload = this.preloads.get(key);
    if (!preload) return;
    this.preloads.delete(key); preload.controller.abort();
    if (preload.voice) this.cleanup(preload.voice, preload.voice.channel);
  }

  private async takePreload(preload: Preload, signal: AbortSignal) {
    const abort = () => preload.controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    let voice: Voice | undefined;
    try {
      if (signal.aborted) abort();
      voice = await preload.promise;
      if (signal.aborted) throw new DOMException('Playback superseded', 'AbortError');
      await new Promise<void>((resolve, reject) => {
        const cancelled = () => finish(new DOMException('Playback superseded', 'AbortError'));
        const timeout = setTimeout(() => finish(new Error('Audio start timed out')), TRANSITIONS.loadTimeout);
        const finish = (error?: unknown) => {
          clearTimeout(timeout); signal.removeEventListener('abort', cancelled);
          if (error) reject(error); else resolve();
        };
        signal.addEventListener('abort', cancelled, { once: true });
        void voice!.audio.play().then(() => finish(), finish);
      });
      return voice;
    } catch (error) {
      if (voice) this.cleanup(voice, voice.channel);
      throw error;
    } finally { signal.removeEventListener('abort', abort); }
  }

  /** Prepare every replacement before changing any audible stream in this batch. */
  async apply(specs: StreamSpec[], keys: string[], duration: number = TRANSITIONS.replacement): Promise<boolean> {
    if (!this.unlocked || this.disposed) throw new Error('Start audio with a user gesture first');
    if (new Set(specs.map(spec => spec.key)).size !== specs.length) throw new Error('Duplicate audio channel');
    const affected = new Set([...keys, ...specs.map(spec => spec.key)]);
    const controller = new AbortController();
    for (const key of affected) this.pending.get(key)?.abort();
    for (const key of affected) this.pending.set(key, controller);
    const prepared = new Map<string, Voice>();
    const revisions = new Map(specs.map(spec => [spec.key, this.channel(spec.key).volumeRevision]));
    try {
      await Promise.all(specs.map(async spec => {
        const channel = this.channel(spec.key);
        const reusable = !spec.restart && [...channel.voices].find(voice => voice.url === spec.url && voice.loop === spec.loop && !voice.disposed && !voice.audio.ended);
        const cached = this.preloads.get(spec.key);
        let voice: Voice;
        if (reusable) voice = reusable;
        else if (cached?.spec.url === spec.url && cached.spec.loop === spec.loop) {
          this.preloads.delete(spec.key);
          voice = await this.takePreload(cached, controller.signal);
        } else {
          this.cancelPreload(spec.key);
          voice = await this.prepare(channel, spec, controller.signal);
        }
        if (controller.signal.aborted) {
          if (!reusable) this.cleanup(voice, channel);
          return;
        }
        prepared.set(spec.key, voice);
      }));
      if (controller.signal.aborted || this.disposed) return false;
      for (const key of affected) {
        const channel = this.channels.get(key);
        if (!channel) continue;
        const next = prepared.get(key);
        let transition = seconds(duration);
        if (key === 'music') {
          for (const length of [channel.current?.audio.duration, next?.audio.duration]) {
            if (length && Number.isFinite(length)) transition = Math.min(transition, length / 4);
          }
        }
        if (channel.current !== next) this.cancelLoop(channel);
        for (const voice of channel.voices) {
          if (voice !== next && !voice.cleanup) this.retire(voice, channel, transition);
        }
        const hadAudio = channel.voices.size > 0;
        channel.current = next;
        if (next) {
          clearTimeout(next.cleanup); next.cleanup = undefined;
          channel.voices.add(next);
          if (channel.paused) next.audio.pause();
          next.envelope.fade(1, transition, true);
          const spec = specs.find(item => item.key === key)!;
          if (channel.volumeRevision === revisions.get(key)) {
            channel.volume = level(spec.volume);
            channel.gain.fade(channel.volume, hadAudio ? transition : 0);
          }
        }
      }
      return true;
    } catch (error) {
      const superseded = controller.signal.aborted;
      controller.abort();
      if (superseded) return false;
      throw error;
    } finally {
      for (const [key, voice] of prepared) {
        const channel = this.channels.get(key);
        if (channel && !channel.voices.has(voice)) this.cleanup(voice, channel);
      }
      for (const key of affected) {
        if (this.pending.get(key) === controller) this.pending.delete(key);
        const channel = this.channels.get(key);
        if (channel) this.dropIdle(channel);
      }
    }
  }

  cancel(keys: string[]) { for (const key of keys) this.pending.get(key)?.abort(); }
  getKeys() { return [...new Set([...this.channels.keys(), ...this.pending.keys()])]; }
  isPaused(key: string) { return this.channels.get(key)?.paused ?? false; }
  getVolume(key: string) { return this.channels.get(key)?.volume; }
  getAudio(key: string) { return this.channels.get(key)?.current?.audio; }
  setEnded(key: string, callback: () => void) {
    const voice = this.channels.get(key)?.current;
    if (!voice) return;
    if (voice.onEnded) voice.audio.removeEventListener('ended', voice.onEnded);
    voice.onEnded = callback;
    voice.audio.addEventListener('ended', callback);
  }
  setVolume(key: string, volume: number, duration: number = TRANSITIONS.volume) {
    const channel = this.channels.get(key);
    if (!channel) return; // Editing an off ambience must not create playback.
    channel.volume = level(volume); channel.volumeRevision++;
    channel.gain.fade(channel.volume, Math.max(TRANSITIONS.volume, duration));
  }
  setMuted(muted: boolean) { this.masterGain.fade(muted ? 0 : 1, TRANSITIONS.transport); }

  async setPaused(key: string, paused: boolean) {
    const channel = this.channel(key);
    const revision = ++channel.transportRevision;
    clearTimeout(channel.pauseTimer);
    channel.paused = paused;
    if (paused) {
      channel.transport.fade(0, channel.voices.size ? TRANSITIONS.transport : 0);
      channel.pauseTimer = setTimeout(() => {
        if (channel.paused && channel.transportRevision === revision) for (const voice of channel.voices) voice.audio.pause();
      }, TRANSITIONS.transport * 1000);
    } else {
      try {
        await Promise.all([...channel.voices].map(voice => voice.audio.play()));
        if (channel.transportRevision === revision) channel.transport.fade(1, TRANSITIONS.transport);
      } catch (error) {
        if (channel.transportRevision === revision) {
          channel.paused = true;
          for (const voice of channel.voices) voice.audio.pause();
          channel.transport.fade(0, TRANSITIONS.transport);
        }
        throw error;
      }
    }
  }

  async stop(key: string, duration: number = TRANSITIONS.replacement) {
    this.cancelPreload(key);
    return this.apply([], [key], duration);
  }

  private retire(voice: Voice, channel: Channel, duration: number, power = true) {
    if (voice.onEnded) voice.audio.removeEventListener('ended', voice.onEnded);
    voice.onEnded = undefined;
    voice.envelope.fade(0, duration, power);
    clearTimeout(voice.cleanup);
    voice.cleanup = setTimeout(() => this.cleanup(voice, channel), seconds(duration) * 1000);
  }

  private cleanup(voice: Voice, channel: Channel) {
    if (voice.disposed) return;
    voice.disposed = true;
    clearTimeout(voice.cleanup);
    if (voice.onEnded) voice.audio.removeEventListener('ended', voice.onEnded);
    voice.audio.removeEventListener('error', voice.onError);
    voice.audio.pause(); voice.audio.removeAttribute('src'); voice.audio.load();
    voice.audio.parentNode?.removeChild(voice.audio);
    voice.source.disconnect(); voice.node.disconnect();
    channel.voices.delete(voice); this.voices.delete(voice);
    if (channel.current === voice) channel.current = undefined;
    this.dropIdle(channel);
  }

  private dropIdle(channel: Channel) {
    if (channel.current || channel.voices.size || channel.standby || channel.loopController || this.pending.has(channel.key) || this.preloads.has(channel.key)) return;
    clearTimeout(channel.pauseTimer);
    channel.node.disconnect(); channel.transportNode.disconnect();
    this.channels.delete(channel.key);
  }

  private cancelLoop(channel: Channel) {
    channel.loopController?.abort(); channel.loopController = undefined;
    if (channel.standby) this.cleanup(channel.standby, channel);
    channel.standby = undefined; channel.loopAttempt = undefined; channel.loopStarting = undefined;
  }

  private checkLoops() {
    if (this.context.state !== 'running') return;
    for (const channel of this.channels.values()) {
      const voice = channel.current;
      if (!voice?.loop || channel.paused || voice.disposed) continue;
      const duration = voice.audio.duration;
      if (!Number.isFinite(duration) || duration <= 0) continue;
      const overlap = Math.min(TRANSITIONS.replacement, duration / 4);
      const remaining = duration - voice.audio.currentTime;
      if (remaining > overlap + 5) continue;
      if (channel.loopAttempt !== voice) {
        channel.loopAttempt = voice;
        const controller = new AbortController(); channel.loopController = controller;
        void this.prepare(channel, { key: channel.key, url: voice.url, volume: channel.volume, loop: true }, controller.signal, false)
          .then(next => {
            if (channel.current !== voice || controller.signal.aborted) this.cleanup(next, channel);
            else channel.standby = next;
          }).catch(error => { if (!controller.signal.aborted) this.onError(error); });
      }
      const next = channel.standby;
      if (remaining > overlap || !next || channel.loopStarting) continue;
      channel.loopStarting = next;
      void next.audio.play().then(() => {
        if (channel.current !== voice || next.disposed || channel.paused) { if (!next.disposed) next.audio.pause(); return; }
        channel.standby = undefined;
        channel.current = next; channel.voices.add(next);
        const fade = Math.max(0.01, Math.min(overlap, duration - voice.audio.currentTime));
        // Same-source overlaps use linear gains to avoid boosting correlated audio.
        next.envelope.fade(1, fade);
        this.retire(voice, channel, fade, false);
      }).catch(error => {
        const report = !next.disposed && channel.current === voice;
        this.cleanup(next, channel);
        if (channel.standby === next) channel.standby = undefined;
        if (report) this.onError(error);
      }).finally(() => { if (channel.loopStarting === next) channel.loopStarting = undefined; });
    }
  }

  async playOneShot(url: string, volume: number) {
    const key = `oneshot:${++this.shotIndex}`;
    this.shots = this.shots.filter(id => this.channels.get(id)?.current || this.pending.has(id));
    while (this.shots.length >= 10) {
      const oldest = this.shots.shift()!;
      void this.stop(oldest, 0.01);
    }
    this.shots.push(key);
    try {
      if (await this.apply([{ key, url, volume, loop: false }], [key], 0.005)) {
        this.setEnded(key, () => { const channel = this.channels.get(key)!; if (channel.current) this.cleanup(channel.current, channel); });
      }
    } catch (error) { this.shots = this.shots.filter(id => id !== key); throw error; }
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.loopTimer);
    for (const controller of this.pending.values()) controller.abort();
    this.pending.clear();
    for (const key of this.preloads.keys()) this.cancelPreload(key);
    for (const channel of this.channels.values()) {
      this.cancelLoop(channel); clearTimeout(channel.pauseTimer);
      for (const voice of [...channel.voices]) this.cleanup(voice, channel);
      channel.node.disconnect(); channel.transportNode.disconnect();
    }
    for (const voice of [...this.voices]) this.cleanup(voice, voice.channel);
    this.channels.clear(); this.master.disconnect();
    await this.context.close();
  }
}
