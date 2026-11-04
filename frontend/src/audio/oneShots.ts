import { level, TRANSITIONS } from './transitions';

/** Short effects decode once, then start at sample zero without waiting on media playback. */
export class OneShotPlayer {
  private buffers = new Map<string, AudioBuffer>();
  private pending = new Map<string, { controller: AbortController; promise: Promise<AudioBuffer> }>();
  private active = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  private disposed = false;
  private context: AudioContext;
  private output: AudioNode;
  constructor(context: AudioContext, output: AudioNode) { this.context = context; this.output = output; }

  private load(url: string) {
    const cached = this.buffers.get(url);
    if (cached) return Promise.resolve(cached);
    const existing = this.pending.get(url);
    if (existing) return existing.promise;
    const controller = new AbortController();
    const promise = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const buffer = await Promise.race([
          (async () => {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`One-shot unavailable (HTTP ${response.status}): ${url}`);
            const data = await response.arrayBuffer();
            if (data.byteLength > 32 * 1024 * 1024) throw new Error(`One-shot is too large to decode: ${url}`);
            return this.context.decodeAudioData(data);
          })(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error(`One-shot download or decoding timed out: ${url}`)); }, TRANSITIONS.loadTimeout);
          }),
        ]);
        if (this.disposed) throw new Error('Audio engine is disposed');
        // Bound decoded memory independently of compressed file size.
        const bytes = (item: AudioBuffer) => item.length * item.numberOfChannels * 4;
        if (bytes(buffer) <= 32 * 1024 * 1024) {
          while (this.buffers.size && (this.buffers.size >= 8 || [...this.buffers.values()].reduce((sum, item) => sum + bytes(item), bytes(buffer)) > 32 * 1024 * 1024)) {
            this.buffers.delete(this.buffers.keys().next().value!);
          }
          this.buffers.set(url, buffer);
        }
        return buffer;
      } catch (error) {
        throw new Error(`Cannot play one-shot: ${error instanceof Error ? error.message : String(error)}`);
      } finally { clearTimeout(timer); this.pending.delete(url); }
    })();
    this.pending.set(url, { controller, promise });
    return promise;
  }

  async play(url: string, volume: number) {
    if (this.disposed) throw new Error('Audio engine is disposed');
    const buffer = await this.load(url);
    if (this.disposed) return;
    while (this.active.size >= 10) {
      const oldest = this.active.values().next().value!;
      oldest.gain.gain.setTargetAtTime(0, this.context.currentTime, 0.005);
      oldest.source.stop(this.context.currentTime + 0.03);
      this.active.delete(oldest);
    }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer; gain.gain.value = level(volume);
    source.connect(gain); gain.connect(this.output);
    const voice = { source, gain };
    source.onended = () => { source.disconnect(); gain.disconnect(); this.active.delete(voice); };
    this.active.add(voice);
    // Preserve the effect's attack; scene/music transitions use their own fades.
    try { source.start(); } catch (error) { this.active.delete(voice); source.disconnect(); gain.disconnect(); throw error; }
  }

  dispose() {
    this.disposed = true;
    for (const item of this.pending.values()) item.controller.abort();
    this.buffers.clear();
    for (const voice of this.active) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); }
    this.active.clear();
  }
}
