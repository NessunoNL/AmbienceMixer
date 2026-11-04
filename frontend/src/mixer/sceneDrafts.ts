import type { Scene, SceneWrite } from '../types';

export function scenePayload(scene: Scene): SceneWrite {
  return { id: scene.id, label: scene.label.trim(), icon: scene.icon,
    environment_id: scene.environment ? Number(scene.environment.id) : null,
    environmentVolume: scene.environmentVolume ?? 70,
    ambiences: (scene.ambiences ?? []).map(({ audioId, volume, enabled }) => ({ audioId, volume, enabled })),
    oneshots: scene.oneshots.map(sound => Number(sound.id)) };
}
export const sameScene = (a?: Scene, b?: Scene) => !!a && !!b && JSON.stringify(scenePayload(a)) === JSON.stringify(scenePayload(b));
/** One-shot membership and scene names are edits, not playback transitions. */
export const sameScenePlayback = (a?: Scene, b?: Scene) => {
  if (!a || !b || a.id !== b.id) return false;
  const audio = (scene: Scene) => {
    const { environment_id, environmentVolume, ambiences } = scenePayload(scene);
    return { environment_id, environmentVolume, ambiences };
  };
  return JSON.stringify(audio(a)) === JSON.stringify(audio(b));
};

/** Only the active scene's draft controls its trigger strip; other scene edits stay separate. */
export function activeSceneWithShots(active: Scene | undefined, drafts: Record<string, Scene>) {
  return active ? { ...active, oneshots: drafts[active.id]?.oneshots ?? active.oneshots } : undefined;
}
export interface DraftState { saved: Record<string, Scene>; drafts: Record<string, Scene>; preparedId: string | null }

/** Session drafts survive selection, cancellation and asynchronous save failures. */
export class SceneDrafts {
  private state: DraftState = { saved: {}, drafts: {}, preparedId: null };
  private listeners = new Set<() => void>();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: DraftState) { this.state = state; this.listeners.forEach(listener => listener()); }
  load(scenes: Scene[]) {
    const saved = Object.fromEntries(scenes.map(scene => [scene.id, structuredClone(scene)]));
    this.publish({ saved, drafts: structuredClone(saved), preparedId: scenes[0]?.id ?? null });
  }
  select(id: string | null) { this.publish({ ...this.state, preparedId: id }); }
  create() {
    const scene: Scene = { id: crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''), label: 'New scene', icon: 'Trees', environmentVolume: 70, ambiences: [], oneshots: [] };
    this.publish({ ...this.state, drafts: { ...this.state.drafts, [scene.id]: scene }, preparedId: scene.id });
  }
  edit(id: string, update: (scene: Scene) => Scene) {
    const draft = this.state.drafts[id];
    if (draft) this.publish({ ...this.state, drafts: { ...this.state.drafts, [id]: update(structuredClone(draft)) } });
  }
  revert(id: string) {
    const saved = this.state.saved[id];
    if (saved) this.edit(id, () => structuredClone(saved));
  }
  saved(scene: Scene) {
    // The request's snapshot becomes saved; edits made during the request remain a draft.
    this.publish({ ...this.state, saved: { ...this.state.saved, [scene.id]: structuredClone(scene) } });
  }
  remove(id: string) {
    const saved = { ...this.state.saved }, drafts = { ...this.state.drafts };
    delete saved[id]; delete drafts[id];
    this.publish({ saved, drafts, preparedId: this.state.preparedId === id ? null : this.state.preparedId });
  }
}
