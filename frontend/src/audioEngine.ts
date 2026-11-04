import type { LayerType } from './types';
import { StreamMixer } from './audio/streamMixer';
import { ScenePlaybackController } from './audio/scenePlayback';
import { MusicQueueController } from './audio/musicQueue';
import { TRANSITIONS } from './audio/transitions';

/** Compatibility facade for the existing UI; all streams share one mixer. */
export class AudioEngine {
  readonly mixer: StreamMixer;
  readonly scenes: ScenePlaybackController;
  readonly music: MusicQueueController;
  private onTrackChangeCallback: (() => void) | null = null;

  constructor(context?: AudioContext) {
    this.mixer = new StreamMixer(context);
    this.scenes = new ScenePlaybackController(this.mixer);
    this.music = new MusicQueueController(this.mixer);
    this.music.subscribe(() => this.onTrackChangeCallback?.());
  }
  setOnTrackChange(callback: (() => void) | null) { this.onTrackChangeCallback = callback; }
  resume() { return this.mixer.resume(); }
  setMuted(muted: boolean) { this.mixer.setMuted(muted); }
  setPaused(type: LayerType, paused: boolean) { return type === 'music' ? this.music.setPaused(paused) : this.mixer.setPaused(type, paused); }
  async dispose() { this.onTrackChangeCallback = null; this.music.dispose(); await this.mixer.dispose(); }

  async loadLayer(type: LayerType, url: string, volume = 1, crossfadeDuration: number = TRANSITIONS.replacement) {
    if (type === 'music') return this.music.playSingle(url, volume, crossfadeDuration);
    return this.mixer.apply([{ key: type, url, volume, loop: true }], [type], crossfadeDuration);
  }
  async crossfadeLayer(type: LayerType, targetVolume: number, duration = 1000) { this.setVolume(type, targetVolume, duration / 1000); }
  setVolume(type: LayerType, volume: number, fadeDuration: number = TRANSITIONS.volume) {
    if (type === 'music') this.music.setVolume(volume, fadeDuration);
    else this.mixer.setVolume(type, volume, fadeDuration);
  }
  async stopLayer(type: LayerType, fadeOut = true, fadeDuration: number = TRANSITIONS.replacement) {
    if (type === 'music') return this.music.stop(fadeOut ? fadeDuration : 0);
    await this.mixer.stop(type, fadeOut ? fadeDuration : 0);
  }
  playOneShot(url: string, volume = 0.8) { return this.mixer.playOneShot(url, volume); }

  async loadMusicPlaylist(tracks: Array<{ url: string; name: string }>, volume = 1, shuffle = true, duration: number = TRANSITIONS.replacement) {
    return this.music.applyMood({ id: 'legacy-playlist', name: 'Playlist', tracks: tracks.map(track => ({ ...track, id: track.url })) }, duration, shuffle, volume);
  }
  playNextTrack() { return this.music.next(); }
  getCurrentTrackInfo(): { name: string; index: number; total: number } | null {
    const state = this.music.getSnapshot();
    return state.current ? { name: state.current.name, index: (state.playedCount - 1) % state.total, total: state.total } : null;
  }
}
