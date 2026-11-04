import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../audioEngine';
import { api } from '../services/api';
import type { AudioLibrary, SoundCategory } from '../services/api';
import type { MusicTag, Scene } from '../types';
import type { MusicQueueSnapshot } from '../audio/musicQueue';
import { SceneDrafts, scenePayload } from './sceneDrafts';

const emptyLibrary: AudioLibrary = { environment: [], weather: [], music: [], oneshots: [] };
const emptyMusic: MusicQueueSnapshot = { mood: null, preparedMood: null, current: null, upcoming: [], paused: false, volume: .5, transitioning: false, error: null, playedCount: 0, total: 0 };
function preference(key: string, fallback: number) {
  try { const value = localStorage.getItem(`mixer-${key}`); return value !== null && Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : fallback; } catch { return fallback; }
}
export function persist(key: string, value: number) { try { localStorage.setItem(`mixer-${key}`, String(value)); } catch { /* Private browsing can disable storage. */ } }
export function useMixer() {
  const [store] = useState(() => new SceneDrafts());
  const drafts = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [engine, setEngine] = useState<AudioEngine | null>(null);
  const [library, setLibrary] = useState(emptyLibrary), [categories, setCategories] = useState<SoundCategory[]>([]), [tags, setTags] = useState<MusicTag[]>([]);
  const [music, setMusic] = useState(emptyMusic), [active, setActive] = useState<Scene>();
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [applying, setApplying] = useState(false);
  const [ready, setReady] = useState(false), [muted, setMuted] = useState(false);
  const [shotVolume, setShotVolume] = useState(() => preference('shot-volume', 80));
  const [sceneDuration, setSceneDuration] = useState(() => Math.max(1, Math.min(15, preference('scene-transition', 3))));
  const [musicDuration, setMusicDuration] = useState(() => Math.max(1, Math.min(15, preference('music-transition', 3))));
  const initialization = useRef(0);
  const moodRequest = useRef(0), sceneRequest = useRef(0), loadingRequest = useRef(0);
  const [preparingMood, setPreparingMood] = useState(false);
  const report = (cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause));
  const run = async (operation: () => Promise<unknown> | unknown) => { try { await operation(); } catch (cause) { report(cause); } };
  useEffect(() => {
    const instance = new AudioEngine(); setEngine(instance);
    instance.mixer.onError = report;
    instance.music.setVolume(preference('music-volume', 50) / 100);
    setMusic(instance.music.getSnapshot());
    const unsubscribe = instance.music.subscribe(() => setMusic(instance.music.getSnapshot()));
    return () => { unsubscribe(); void instance.dispose(); };
  }, []);
  const refreshLibrary = async () => {
    const request = ++loadingRequest.current;
    const [files, cats, moods] = await Promise.all([api.getAudioLibrary(), api.getSoundCategories(), api.getAllMusicTags()]);
    if (request !== loadingRequest.current) return;
    setLibrary(files); setCategories(cats); setTags(moods);
  };
  const initialize = async () => {
    const request = ++initialization.current;
    setLoading(true);
    try {
      const scenes = await api.getScenes(); await refreshLibrary();
      if (request === initialization.current) { store.load(scenes); setError(''); }
    } catch (cause) { if (request === initialization.current) report(cause); }
    finally { if (request === initialization.current) setLoading(false); }
  };
  useEffect(() => { void initialize(); return () => { initialization.current++; loadingRequest.current++; }; }, []);
  useEffect(() => { engine?.music.setTransitionDuration(musicDuration); persist('music-transition', musicDuration); }, [engine, musicDuration]);
  useEffect(() => { persist('scene-transition', sceneDuration); }, [sceneDuration]);
  useEffect(() => { persist('shot-volume', shotVolume); }, [shotVolume]);
  const unlock = async () => { if (!engine) throw new Error('Audio is still initializing. Try again.'); await engine.resume(); setReady(true); };
  const applyScene = async () => {
    const state = store.getSnapshot(), scene = state.preparedId ? state.drafts[state.preparedId] : undefined;
    if (!scene || !engine) return;
    const request = ++sceneRequest.current; setApplying(true);
    try { await unlock(); if (request !== sceneRequest.current) return; if (await engine.scenes.applyScene(scene, sceneDuration)) setActive(engine.scenes.getActiveScene()); }
    finally { if (request === sceneRequest.current) setApplying(false); }
  };
  const cancelScene = () => { sceneRequest.current++; engine?.scenes.cancelPending(); setApplying(false); store.select(null); };
  const selectScene = (id: string | null) => { cancelScene(); store.select(id); };
  const createScene = () => { cancelScene(); store.create(); };
  const save = async () => {
    const state = store.getSnapshot(), scene = state.preparedId ? structuredClone(state.drafts[state.preparedId]) : undefined;
    if (!scene || saving) return;
    if (!scene.label.trim()) { setError('Give the scene a name before saving.'); return; }
    setSaving(true);
    try {
      const payload = scenePayload(scene);
      if (state.saved[scene.id]) await api.updateScene(scene.id, payload); else await api.createScene(payload);
      store.saved(scene); setError('');
    } catch (cause) { setError(`${cause instanceof Error ? cause.message : 'Save failed'}. Your draft is retained. Check the connection and press Save to retry.`); }
    finally { setSaving(false); }
  };
  const remove = async (scene: Scene) => {
    if (!confirm(`Delete “${scene.label}”? Active playback will continue until another scene is applied.`)) return;
    if (store.getSnapshot().saved[scene.id]) await api.deleteScene(scene.id);
    store.remove(scene.id);
  };
  const prepareMood = async (id: string) => {
    const request = ++moodRequest.current;
    if (!id) { engine?.music.cancelPrepared(); setPreparingMood(false); return; }
    const tag = tags.find(item => String(item.id) === id); if (!tag || !engine) return;
    engine.music.cancelPrepared(); setPreparingMood(true);
    try {
      const tracks = await api.getAudioFilesByTag(tag.id);
      if (request !== moodRequest.current) return;
      if (!tracks.length) throw new Error(`“${tag.name}” has no songs. Assign music in Library first.`);
      engine.music.prepareMood({ id, name: tag.name, tracks: tracks.map(file => ({ id: String(file.id), name: file.name, url: api.getAudioStreamUrl(file.id) })) });
    } catch (cause) { if (request === moodRequest.current) report(cause); }
    finally { if (request === moodRequest.current) setPreparingMood(false); }
  };
  const cancelMood = () => { moodRequest.current++; setPreparingMood(false); engine?.music.cancelPrepared(); };
  const applyMood = async () => { const request = moodRequest.current; if (engine?.music.getSnapshot().preparedMood) { await unlock(); if (request === moodRequest.current) await engine.music.applyPrepared(musicDuration); } };
  const liveVolume = (scene: Scene, id: number | 'environment', value: number) => {
    if (id === 'environment' && scene.environment) engine?.scenes.setEnvironmentVolume(scene.id, scene.environment.id, value);
    else if (typeof id === 'number') engine?.scenes.setAmbienceVolume(scene.id, id, value);
    setActive(engine?.scenes.getActiveScene());
  };
  return { store, drafts, engine, library, categories, tags, music, active, error, setError, loading, saving, applying, ready, muted,
    shotVolume, setShotVolume, sceneDuration, setSceneDuration, musicDuration, setMusicDuration, preparingMood, run, unlock,
    initialize, refreshLibrary, applyScene, cancelScene, selectScene, createScene, save, remove, prepareMood, cancelMood, applyMood, liveVolume,
    toggleMute: () => { engine?.setMuted(!muted); setMuted(!muted); } };
}
export type Mixer = ReturnType<typeof useMixer>;
