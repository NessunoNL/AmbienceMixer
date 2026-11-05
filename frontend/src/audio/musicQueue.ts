import { StreamMixer } from './streamMixer';
import { level, seconds, TRANSITIONS } from './transitions';

export interface MusicTrack { id: string; name: string; url: string; }
export interface MusicMood { id: string; name: string; tracks: MusicTrack[]; }
export interface MusicQueueSnapshot {
  mood: { id: string; name: string } | null;
  preparedMood: MusicMood | null;
  current: MusicTrack | null;
  upcoming: MusicTrack[];
  paused: boolean;
  volume: number;
  transitioning: boolean;
  error: string | null;
  playedCount: number;
  total: number;
}
interface ActiveQueue {
  mood: MusicMood;
  current: MusicTrack;
  upcoming: MusicTrack[];
  shuffle: boolean;
  playedCount: number;
  failed: Set<string>;
}

/** UI subscriptions receive snapshots; only apply/transport actions affect playback. */
export class MusicQueueController {
  private mixer: StreamMixer;
  private active: ActiveQueue | null = null;
  private prepared: MusicMood | null = null;
  private listeners = new Set<() => void>();
  private revision = 0;
  private busy = false;
  private disposed = false;
  private paused = false;
  private volume = 1;
  private duration: number = TRANSITIONS.replacement;
  private error: string | null = null;
  private autoBlocked = false;
  private preloadingId: string | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private random: () => number;

  constructor(mixer: StreamMixer, random = Math.random) { this.mixer = mixer; this.random = random; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(); }
  getSnapshot(): MusicQueueSnapshot {
    return structuredClone({ mood: this.active ? { id: this.active.mood.id, name: this.active.mood.name } : null,
      preparedMood: this.prepared, current: this.active?.current ?? null, upcoming: this.active?.upcoming ?? [],
      paused: this.paused, volume: this.volume, transitioning: this.busy, error: this.error,
      playedCount: this.active?.playedCount ?? 0, total: this.active?.mood.tracks.length ?? 0 });
  }
  private validate(mood: MusicMood): MusicMood {
    if (!mood.tracks.length) throw new Error('This mood has no music');
    if (mood.tracks.some(track => !track.id || !track.url)) throw new Error('Music tracks need IDs and URLs');
    if (new Set(mood.tracks.map(track => track.id)).size !== mood.tracks.length) throw new Error('Duplicate music track IDs');
    return structuredClone(mood);
  }
  prepareMood(mood: MusicMood) { this.prepared = this.validate(mood); this.emit(); }
  cancelPrepared() { this.prepared = null; this.cancelPending(); }
  async applyPrepared(duration: number = this.duration) {
    if (!this.prepared) return false;
    return this.applyMood(this.prepared, duration);
  }
  setTransitionDuration(duration: number) { this.duration = seconds(duration); }
  setVolume(volume: number, fade: number = TRANSITIONS.volume) {
    this.volume = level(volume); this.mixer.setVolume('music', this.volume, fade); this.emit();
  }
  async setPaused(paused: boolean) {
    this.paused = paused; this.emit();
    try { await this.mixer.setPaused('music', paused, this.duration); }
    catch (error) { this.paused = true; this.error = String(error); this.emit(); throw error; }
  }

  private cycle(mood: MusicMood, shuffle: boolean, previous?: string, failed = new Set<string>()) {
    const tracks = mood.tracks.filter(track => !failed.has(track.id));
    if (shuffle) for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    if (tracks.length > 1 && tracks[0].id === previous) {
      const index = tracks.findIndex(track => track.id !== previous);
      [tracks[0], tracks[index]] = [tracks[index], tracks[0]];
    }
    return tracks;
  }
  private clearPreload() { this.preloadingId = null; this.mixer.cancelPreload('music'); }
  cancelPending() {
    this.revision++; this.busy = false; this.mixer.cancel(['music']); this.clearPreload(); this.emit();
  }

  async applyMood(input: MusicMood, duration: number = this.duration, shuffle = true, initialVolume = this.volume) {
    if (this.disposed) throw new Error('Music queue is disposed');
    this.cancelPending();
    const prepared = this.prepared;
    const mood = this.validate(input);
    this.duration = seconds(duration);
    const revision = ++this.revision;
    this.busy = true; this.error = null; this.emit();
    const failed = new Set<string>();
    const candidates = this.cycle(mood, shuffle, this.active?.current.id);
    try {
      for (let index = 0; index < candidates.length; index++) {
        if (revision !== this.revision) return false;
        try {
          const applied = await this.play(candidates[index], initialVolume, this.duration);
          if (!applied || revision !== this.revision) return false;
          this.active = { mood, current: candidates[index], upcoming: candidates.slice(index + 1), shuffle, playedCount: 1, failed };
          this.finishCommit();
          if (this.prepared === prepared && prepared?.id === mood.id) this.prepared = null;
          return true;
        } catch (error) {
          if (revision !== this.revision) return false;
          failed.add(candidates[index].id); this.error = String(error);
        }
      }
      throw new Error(`No playable tracks in this mood; previous music has been kept. ${this.error ?? ''}`);
    } catch (error) {
      if (revision === this.revision) this.error = String(error);
      throw error;
    } finally { if (revision === this.revision) { this.busy = false; this.emit(); } }
  }

  private play(track: MusicTrack, volume: number, duration: number) {
    if (this.paused && !this.mixer.isPaused('music')) void this.mixer.setPaused('music', true);
    return this.mixer.apply([{ key: 'music', url: track.url, volume, loop: false, restart: true }], ['music'], duration);
  }
  private finishCommit() {
    const active = this.active!;
    active.upcoming = active.upcoming.filter(track => !active.failed.has(track.id));
    if (!active.upcoming.length) active.upcoming = this.cycle(active.mood, active.shuffle, active.current.id, active.failed);
    this.volume = this.mixer.getVolume('music') ?? this.volume;
    this.autoBlocked = false; this.preloadingId = null;
    const audio = this.mixer.getAudio('music');
    this.mixer.setEnded('music', () => {
      if (this.active === active && this.mixer.getAudio('music') === audio && !this.busy && !this.paused && !this.autoBlocked) this.advanceAutomatically();
    });
    this.timer ??= setInterval(() => this.tick(), 100);
  }

  async next() { return this.advance(false); }
  async selectTrack(id: string) {
    if (!this.active) return false;
    if (this.active.current.id === id && !this.mixer.getAudio('music')?.ended) return true;
    const index = this.active.upcoming.findIndex(track => track.id === id);
    if (index < 0) throw new Error('Track is not in the upcoming queue');
    return this.advance(false, index);
  }

  private async advance(automatic: boolean, selectedIndex?: number) {
    if (!this.active || this.disposed || (automatic && (this.busy || this.paused || this.autoBlocked))) return false;
    const active = this.active;
    const revision = ++this.revision;
    this.mixer.cancel(['music']);
    if (!automatic) { this.autoBlocked = false; active.failed.clear(); }
    if (selectedIndex !== undefined && selectedIndex !== 0) this.clearPreload();
    this.busy = true; this.error = null; this.emit();
    const failed = new Set(active.failed);
    const start = selectedIndex ?? 0;
    const candidates = active.upcoming.slice(start);
    const primaryLength = candidates.length;
    if (selectedIndex === undefined) {
      for (const track of this.cycle(active.mood, active.shuffle, active.current.id, failed)) {
        if (!candidates.some(item => item.id === track.id)) candidates.push(track);
      }
    }
    const attempted = new Set<string>();
    try {
      for (let index = 0; index < candidates.length; index++) {
        const track = candidates[index];
        if (attempted.has(track.id) || failed.has(track.id)) continue;
        attempted.add(track.id);
        if (revision !== this.revision) return false;
        try {
          const audio = this.mixer.getAudio('music');
          let duration = this.duration;
          if (automatic && audio && Number.isFinite(audio.duration)) {
            duration = Math.min(duration, audio.duration / 4, Math.max(0.01, audio.duration - audio.currentTime));
          }
          const applied = await this.play(track, this.volume, duration);
          if (!applied || revision !== this.revision) return false;
          const remaining = selectedIndex === undefined ? candidates.slice(index + 1, index < primaryLength ? primaryLength : undefined) : active.upcoming.slice(start + 1);
          this.active = { ...active, current: track, upcoming: remaining, failed, playedCount: active.playedCount + 1 };
          this.finishCommit();
          return true;
        } catch (error) {
          if (revision !== this.revision) return false;
          failed.add(track.id); this.error = String(error); this.preloadingId = null;
          if (selectedIndex !== undefined) throw error;
        }
      }
      throw new Error('No playable next song; choose a song or mood to retry');
    } catch (error) {
      if (revision === this.revision) {
        active.failed = failed; this.autoBlocked = true; this.error = String(error);
      }
      throw error;
    } finally { if (revision === this.revision) { this.busy = false; this.emit(); } }
  }

  reshuffleUpcoming() {
    if (!this.active) return;
    this.cancelPending();
    const tracks = [...this.active.upcoming];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    if (tracks.length > 1 && tracks[0].id === this.active.current.id) {
      const index = tracks.findIndex(track => track.id !== this.active!.current.id);
      if (index >= 0) [tracks[0], tracks[index]] = [tracks[index], tracks[0]];
    }
    this.active.upcoming = tracks; this.emit();
  }

  private advanceAutomatically() { void this.advance(true).catch(error => this.mixer.onError(error)); }
  private tick() {
    const active = this.active;
    const audio = this.mixer.getAudio('music');
    if (!active || !audio || this.busy || this.paused || this.autoBlocked || this.mixer.context.state !== 'running') return;
    const next = active.upcoming.find(track => !active.failed.has(track.id));
    if (next && next.id !== this.preloadingId) {
      this.preloadingId = next.id;
      const revision = this.revision;
      void this.mixer.preload({ key: 'music', url: next.url, volume: this.volume, loop: false }).catch(error => {
        if (this.revision !== revision || this.active !== active) return;
        active.failed.add(next.id); this.preloadingId = null; this.error = String(error);
        if (active.mood.tracks.every(track => active.failed.has(track.id))) this.autoBlocked = true;
        this.emit();
      });
    }
    if (audio.ended) { this.advanceAutomatically(); return; }
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const overlap = Math.min(this.duration, audio.duration / 4);
    if (audio.duration - audio.currentTime <= overlap) this.advanceAutomatically();
  }

  async playSingle(url: string, volume: number, duration: number) {
    this.cancelPending();
    const revision = ++this.revision;
    this.busy = true; this.emit();
    try {
      if (this.paused && !this.mixer.isPaused('music')) void this.mixer.setPaused('music', true);
      const applied = await this.mixer.apply([{ key: 'music', url, volume, loop: true }], ['music'], duration);
      if (applied && revision === this.revision) {
        this.volume = this.mixer.getVolume('music') ?? volume; this.clear();
      }
      return applied;
    } finally { if (revision === this.revision) { this.busy = false; this.emit(); } }
  }

  async stop(duration: number = this.duration) { this.clear(); await this.mixer.stop('music', duration); }

  /** Used when legacy single-track playback takes over; it does not stop audio. */
  clear() {
    this.cancelPending(); clearInterval(this.timer); this.timer = undefined;
    this.active = null; this.prepared = null; this.autoBlocked = false; this.error = null; this.emit();
  }
  dispose() { this.clear(); this.disposed = true; this.listeners.clear(); }
}
