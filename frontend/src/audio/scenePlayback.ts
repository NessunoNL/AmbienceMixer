import type { Scene } from '../types';
import { StreamMixer } from './streamMixer';
import type { StreamSpec } from './streamMixer';
import { TRANSITIONS } from './transitions';

const ambienceKey = (id: number) => `ambience:${id}`;
const sceneKey = (key: string) => key === 'environment' || key === 'weather' || key.startsWith('ambience:');

/** Owns only applied scene state; drafts and saving belong to the editor. */
export class ScenePlaybackController {
  private mixer: StreamMixer;
  private active?: Scene;
  private revision = 0;
  constructor(mixer: StreamMixer) { this.mixer = mixer; }
  getActiveScene() { return this.active ? structuredClone(this.active) : undefined; }

  async applyScene(scene: Scene, duration: number = TRANSITIONS.replacement) {
    this.mixer.cancel(this.mixer.getKeys().filter(sceneKey));
    const revision = ++this.revision;
    const snapshot = structuredClone(scene);
    const specs: StreamSpec[] = [];
    if (snapshot.environment) specs.push({ key: 'environment', url: snapshot.environment.url, volume: (snapshot.environmentVolume ?? 70) / 100, loop: true });
    // Legacy fallback is only for callers that have not adopted the hydrated list.
    const ambiences = snapshot.ambiences ?? (snapshot.weather ? [{ audioId: Number(snapshot.weather.id), volume: snapshot.weatherVolume ?? 45, enabled: true, audio: snapshot.weather }] : []);
    for (const entry of ambiences) {
      if (!entry.enabled) continue;
      if (!entry.audio) throw new Error(`Ambience ${entry.audioId} is unavailable`);
      specs.push({ key: ambienceKey(entry.audioId), url: entry.audio.url, volume: entry.volume / 100, loop: true });
    }
    const applied = await this.mixer.apply(specs, this.mixer.getKeys().filter(sceneKey), duration);
    if (applied && this.revision === revision) {
      // Include live level adjustments made while replacements were loading.
      for (const entry of ambiences) if (entry.enabled) entry.volume = (this.mixer.getVolume(ambienceKey(entry.audioId)) ?? entry.volume / 100) * 100;
      if (snapshot.environment) snapshot.environmentVolume = (this.mixer.getVolume('environment') ?? 0.7) * 100;
      snapshot.ambiences = ambiences;
      this.active = snapshot;
    }
    return applied && this.revision === revision;
  }

  cancelPending() { this.revision++; this.mixer.cancel(this.mixer.getKeys().filter(sceneKey)); }

  setAmbienceVolume(sceneId: string, audioId: number, volume: number) {
    if (this.active?.id !== sceneId) return;
    const entry = this.active.ambiences?.find(item => item.audioId === audioId);
    if (!entry) return;
    entry.volume = Math.max(0, Math.min(100, volume));
    if (entry.enabled) this.mixer.setVolume(ambienceKey(audioId), entry.volume / 100);
  }

  setEnvironmentVolume(sceneId: string, audioId: string, volume: number) {
    if (this.active?.id !== sceneId || this.active.environment?.id !== audioId) return;
    this.active.environmentVolume = Math.max(0, Math.min(100, volume));
    this.mixer.setVolume('environment', this.active.environmentVolume / 100);
  }
}
