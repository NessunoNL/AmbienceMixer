import { useState } from 'react';
import { api } from '../services/api';
import type { AudioFile } from '../services/api';
import type { Scene } from '../types';
import type { Mixer } from './useMixer';
import { sameScene, sameScenePlayback } from './sceneDrafts';
import { SoundPicker } from './SoundPicker';
import { VolumeCard } from './VolumeCard';
import { audioLayer } from './libraryAudio';
export function ScenePanel({ mixer: m }: { mixer: Mixer }) {
  const [picker, setPicker] = useState<'weather' | 'oneshots' | null>(null);
  const scene = m.drafts.preparedId ? m.drafts.drafts[m.drafts.preparedId] : undefined;
  const dirty = scene && !sameScene(scene, m.drafts.saved[scene.id]);
  const update = (fn: (scene: Scene) => Scene) => { if (scene) m.store.edit(scene.id, fn); };
  const ambienceVolume = (id: number, volume: number) => {
    if (!scene) return;
    update(draft => ({ ...draft, ambiences: draft.ambiences?.map(entry => entry.audioId === id ? { ...entry, volume } : entry) }));
    m.liveVolume(scene, id, volume);
  };
  const toggleSound = (file: AudioFile) => update(draft => picker === 'weather'
    ? { ...draft, ambiences: draft.ambiences?.some(entry => entry.audioId === file.id) ? draft.ambiences.filter(entry => entry.audioId !== file.id) : [...(draft.ambiences ?? []), { audioId: file.id, volume: 45, enabled: true, audio: audioLayer(file) }] }
    : { ...draft, oneshots: draft.oneshots.some(sound => sound.id === String(file.id)) ? draft.oneshots.filter(sound => sound.id !== String(file.id)) : [...draft.oneshots, { id: String(file.id), name: file.name, url: api.getAudioStreamUrl(file.id), icon: 'Zap' }] });
  return <section className="panel scene-panel" aria-labelledby="scene-heading">
    <header className="section-head"><div><span className="eyebrow">SET THE SCENE</span><h2 id="scene-heading">Scene</h2></div><button disabled={m.loading} onClick={m.createScene}>＋ New scene</button></header>
    <label>Prepare a scene<select value={scene?.id ?? ''} disabled={m.loading} onChange={event => m.selectScene(event.target.value || null)}><option value="">Choose a scene…</option>{Object.values(m.drafts.drafts).map(item => <option key={item.id} value={item.id}>{item.label}{sameScene(item, m.drafts.saved[item.id]) ? '' : ' • unsaved'}</option>)}</select></label>
    <p className="active-line">Active: <strong>{m.active?.label ?? 'No scene playing'}</strong></p>
    {!scene ? <div className="empty"><h3>Prepare your next setting</h3><p>Choose a scene or create one. Nothing plays until you press Apply.</p></div> : <>
      <div className="scene-title"><label>Scene name<input value={scene.label} onChange={event => update(draft => ({ ...draft, label: event.target.value }))} /></label><span className="badge">Prepared</span></div>
      <div className="actions save-actions"><span className="hint">{dirty ? 'Unsaved draft' : 'Saved'}</span><button disabled={!dirty || m.saving} onClick={() => void m.save()}>{m.saving ? 'Saving…' : 'Save'}</button><button disabled={!dirty || !m.drafts.saved[scene.id] || m.saving} onClick={() => m.store.revert(scene.id)}>Revert</button><button className="danger" disabled={m.saving} onClick={() => void m.run(() => m.remove(scene))}>Delete scene</button></div>
      <div className="environment-row"><label>Environment<select value={scene.environment?.id ?? ''} onChange={event => update(draft => ({ ...draft, environment: m.library.environment.find(file => String(file.id) === event.target.value) ? audioLayer(m.library.environment.find(file => String(file.id) === event.target.value)!) : undefined }))}>
        <option value="">No environment</option>{scene.environment && !m.library.environment.some(file => String(file.id) === scene.environment!.id) && <option value={scene.environment.id}>Unavailable: {scene.environment.name}</option>}{m.library.environment.map(file => <option key={file.id} value={file.id}>{file.name}</option>)}</select></label>
        <VolumeCard maxVolume={20} name="Environment" volume={scene.environmentVolume ?? 70} onChange={volume => { update(draft => ({ ...draft, environmentVolume: volume })); m.liveVolume(scene, 'environment', volume); }} /></div>
      <div className="section-head"><div><h3>Ambiences <span className="count">{scene.ambiences?.length ?? 0}</span></h3><p className="hint">Swipe sideways to adjust volume · ↑ ↓ keys work too</p></div><button onClick={() => setPicker('weather')}>＋ Add sounds</button></div>
      <div className="ambience-grid">{scene.ambiences?.map(entry => {
        const current = m.active?.id === scene.id ? m.active.ambiences?.find(item => item.audioId === entry.audioId) : undefined;
        const playing = !!current?.enabled;
        const pending = m.active?.id === scene.id && playing !== entry.enabled;
        const name = entry.audio?.name ?? `Missing sound #${entry.audioId}`;
        const status = m.active?.id === scene.id ? `${playing ? 'Playing' : 'Off'}${pending ? ` · Pending ${entry.enabled ? 'on' : 'off'}` : ''}` : `Prepared · ${entry.enabled ? 'On' : 'Off'}`;
        return <VolumeCard maxVolume={20} key={entry.audioId} name={name} volume={entry.volume} off={!entry.enabled} status={status} onChange={volume => ambienceVolume(entry.audioId, volume)}>
          <button role="switch" aria-checked={entry.enabled} aria-label={`Enable ${name}`} onClick={() => update(draft => ({ ...draft, ambiences: draft.ambiences?.map(item => item.audioId === entry.audioId ? { ...item, enabled: !item.enabled } : item) }))}>{entry.enabled ? 'On' : 'Off'}</button>
          <button aria-label={`Remove ${name}`} onClick={() => update(draft => ({ ...draft, ambiences: draft.ambiences?.filter(item => item.audioId !== entry.audioId) }))}>×</button>
        </VolumeCard>;
      })}</div>
      {!scene.ambiences?.length && <p className="empty">Layer rain, wildlife or a crackling fire over your environment.</p>}
      <div className="section-head"><div><h3>Scene one-shots <span className="count">{scene.oneshots.length}</span></h3><p className="hint">Updates the active scene’s strip immediately</p></div><button onClick={() => setPicker('oneshots')}>Edit one-shots</button></div>
      <div className="shot-selection">{scene.oneshots.map(sound => <span key={sound.id}>{sound.name}<button aria-label={`Remove ${sound.name}`} onClick={() => update(draft => ({ ...draft, oneshots: draft.oneshots.filter(item => item.id !== sound.id) }))}>×</button></span>)}</div>
      <div className="scene-apply actions">{!sameScenePlayback(scene, m.active) && <button className="primary" onClick={() => void m.run(m.applyScene)}>{m.applying ? 'Applying…' : 'Apply scene'}</button>}<button onClick={m.cancelScene}>Cancel scene</button><label className="duration">Fade<select aria-label="Scene fade duration" value={m.sceneDuration} onChange={event => m.setSceneDuration(Number(event.target.value))}>{[1, 3, 6, 10, 15].map(value => <option key={value} value={value}>{value}s</option>)}</select></label></div>
      <p className="hint">Save stores this draft. Apply changes playback, without saving.</p>
    </>}
    {picker && scene && <SoundPicker title={picker === 'weather' ? 'Add ambiences' : 'Choose one-shots'} files={m.library[picker]} categories={m.categories} selected={picker === 'weather' ? (scene.ambiences ?? []).map(entry => entry.audioId) : scene.oneshots.map(sound => Number(sound.id))} onToggle={toggleSound} onClose={() => setPicker(null)} />}
  </section>;
}
