import { useState } from 'react';
import { AudioLines, VolumeX, Settings, Plus, Music2, Trees, Pause, Play, SkipForward, Shuffle, MoveHorizontal, X, Zap } from 'lucide-react';
import { SoundPicker } from './SoundPicker';
import { audioLayer } from './libraryAudio';
import type { Mixer } from './useMixer';
import { persist } from './useMixer';
import type { Scene, SceneAmbience } from '../types';
import { sameScene } from './sceneDrafts';
import { VolumeCard } from './VolumeCard';
import { Overlay } from './Overlay';
import { ScenePanel } from './ScenePanel';
import { LibraryPanel } from './LibraryPanel';
import { useWakeLock } from './useWakeLock';

type Popup = 'scenes' | 'moods' | 'editor' | 'ambiences' | 'queue' | 'shots' | 'settings' | 'library' | null;
export function PerformanceMixer({ mixer: m }: { mixer: Mixer }) {
  const [picking, setPicking] = useState(false);
  const [popup, setPopup] = useState<Popup>(null), [search, setSearch] = useState(''), [errorDetail, setErrorDetail] = useState('');
  const wake = useWakeLock();
  const open = (next: Popup) => { setSearch(''); setPopup(next); };
  const prepared = m.drafts.preparedId ? m.drafts.drafts[m.drafts.preparedId] : undefined;
  const scene = prepared ?? m.active;
  const pendingScene = !!prepared && !sameScene(prepared, m.active);
  const pendingMood = !!m.music.preparedMood;
  const pending = pendingScene || pendingMood || m.preparingMood;
  const edit = (update: (draft: Scene) => Scene) => {
    if (!scene) return;
    // A deleted active scene remains playable, but editing it creates a fresh session draft.
    if (!m.store.getSnapshot().drafts[scene.id]) return;
    if (!m.drafts.preparedId) m.selectScene(scene.id);
    m.store.edit(scene.id, update);
  };
  const editScene = () => {
    if (scene && m.drafts.drafts[scene.id]) m.selectScene(scene.id); else m.createScene();
    open('editor');
  };
  const ambienceCard = (entry: SceneAmbience) => {
    const name = entry.audio?.name ?? `Unavailable sound ${entry.audioId}`;
    const activeEntry = m.active?.id === scene?.id ? m.active?.ambiences?.find(item => item.audioId === entry.audioId) : undefined;
    const playing = !!activeEntry?.enabled;
    const status = m.active?.id === scene?.id ? `${playing ? 'Playing' : 'Off'}${playing !== entry.enabled ? ` · Pending ${entry.enabled ? 'on' : 'off'}` : ''}` : `Prepared · ${entry.enabled ? 'On' : 'Off'}`;
    return <VolumeCard key={entry.audioId} name={name} volume={entry.volume} off={!entry.enabled} status={status} onChange={volume => {
      edit(draft => ({ ...draft, ambiences: draft.ambiences?.map(item => item.audioId === entry.audioId ? { ...item, volume } : item) }));
      if (scene) m.liveVolume(scene, entry.audioId, volume);
    }}><button role="switch" aria-label={`Enable ${name}`} aria-checked={entry.enabled} disabled={!scene || !m.drafts.drafts[scene.id]} onClick={() => edit(draft => ({ ...draft, ambiences: draft.ambiences?.map(item => item.audioId === entry.audioId ? { ...item, enabled: !item.enabled } : item) }))}>{entry.enabled ? 'On' : 'Off'}</button><button aria-label={`Remove ${name}`} onClick={() => edit(draft => ({ ...draft, ambiences: draft.ambiences?.filter(item => item.audioId !== entry.audioId) }))}><X size={16} /></button></VolumeCard>;
  };
  const shot = (sound: Scene['oneshots'][number]) => <button key={sound.id} title={sound.name} onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.playOneShot(sound.url, m.shotVolume / 100); })}><Zap size={18} aria-hidden="true" /><span>{sound.name}</span></button>;
  const track = (item: typeof m.music.upcoming[number], index: number) => <button className="track-choice song" key={item.id} onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.music.selectTrack(item.id); })}><span>{String(index + 1).padStart(2, '0')}</span><span>{item.name}</span><span aria-hidden="true">↗</span></button>;
  const applyAll = async () => {
    const outcomes = await Promise.allSettled([pendingScene ? m.applyScene() : Promise.resolve(), pendingMood ? m.applyMood() : Promise.resolve()]);
    const failures = outcomes.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
    if (failures.length) throw new Error(`Some changes could not apply: ${failures.map(item => String(item.reason)).join('; ')}. Previous audio is retained for failed changes.`);
  };
  const dirty = !!scene && !sameScene(scene, m.drafts.saved[scene.id]);
  const sceneChoices = Object.values(m.drafts.drafts);
  return <div id="scene-mood" className="mixer-app mockup-app" data-layout="tiles" data-sliders="false">
    <header className="row"><div className="brand"><AudioLines aria-hidden="true" />AmbienceMixer</div><div className="group"><button onClick={() => open('settings')} aria-label="Open settings"><Settings /></button><button aria-pressed={m.muted} onClick={m.toggleMute}><VolumeX /><span>{m.muted ? 'Unmute all' : 'Mute all'}</span></button></div></header>
    <nav className="scenes" aria-label="Saved scenes">{sceneChoices.slice(0, 4).map(item => <button key={item.id} aria-pressed={scene?.id === item.id} onClick={() => m.selectScene(item.id)}>{item.label}</button>)}{sceneChoices.length > 4 && <button onClick={() => open('scenes')}>All scenes</button>}<button className="new" onClick={() => { m.createScene(); open('editor'); }}><Plus />New scene</button></nav>
    <main className="columns">
      <section className="panel scene-panel" aria-label="Scene mixer">
        <div className="row scene-top"><div><div className="eyebrow">Scene</div><h2>{scene?.label ?? 'Choose a scene'}</h2></div><button onClick={editScene} disabled={m.loading}>Edit scene</button></div>
        <div className="environment"><div className="env-select"><Trees /><div><div className="eyebrow">Environment</div><h3>{scene?.environment?.name ?? 'No environment selected'}</h3></div></div><output>{scene?.environmentVolume ?? 70}%</output><div className="level"><input aria-label="Environment volume" type="range" min="0" max="100" disabled={!scene?.environment} value={scene?.environmentVolume ?? 70} onChange={event => { if (!scene) return; const volume = Number(event.target.value); edit(draft => ({ ...draft, environmentVolume: volume })); m.liveVolume(scene, 'environment', volume); }} /></div></div>
        <div className="row subheading"><h3>Ambiences <span className="muted">{scene?.ambiences?.length ?? 0} layers</span></h3><div className="group">{(scene?.ambiences?.length ?? 0) > 4 && <button onClick={() => open('ambiences')}>All sounds</button>}<button disabled={!scene} onClick={() => setPicking(true)}><Plus />Add sounds</button></div></div>
        <div className="ambiences">{scene?.ambiences?.slice(0, 4).map(ambienceCard)}{!scene?.ambiences?.length && <p className="muted">Just the environment. Add sounds to layer the scene.</p>}</div>
        <div className="swipe-hint"><MoveHorizontal />Swipe a card left / right to adjust volume</div>
        <div className="row save-bar"><span className="muted" role="status">{pendingScene ? `Prepared · Active: ${m.active?.label ?? 'none'}` : m.active ? 'Active scene' : 'Prepare a scene, then Apply'}</span><div className="group">{dirty && <button disabled={m.saving} onClick={() => { if (scene) m.store.revert(scene.id); }}>Revert</button>}<button disabled={!dirty || m.saving} onClick={() => void m.run(m.save)}>{m.saving ? 'Saving…' : dirty ? 'Save scene' : 'Saved'}</button>{pendingScene && <button className="primary" onClick={() => void m.run(m.applyScene)}>Apply scene</button>}</div></div>
      </section>
      <section className="panel music-panel" aria-label="Music mixer">
        <div className="row"><div><div className="eyebrow">Music</div><h2>Set the mood</h2></div><Music2 /></div>
        <div className="moods">{m.tags.slice(0, 4).map(item => <button key={item.id} aria-pressed={String(item.id) === (m.music.preparedMood?.id ?? m.music.mood?.id)} onClick={() => void m.prepareMood(String(item.id))}>{item.name}</button>)}{m.tags.length > 4 && <button onClick={() => open('moods')}>More moods</button>}{!m.tags.length && <button onClick={() => open('library')}>Add moods in Library</button>}</div>
        <div className="now"><div className="row"><span className="eyebrow">{m.music.paused ? 'Paused' : m.music.current ? 'Now playing' : 'Ready when you are'}</span><span className="muted">{m.music.mood ? `${m.music.mood.name} · shuffled` : 'Choose a mood'}</span></div><div className="now-title" title={m.music.current?.name}>{m.music.current?.name ?? 'Your soundtrack starts here'}</div><div className="row"><span className="muted">{pendingMood ? `Prepared: ${m.music.preparedMood?.name}` : 'Music continues across scenes'}</span><div className="now-actions"><button aria-label={m.music.paused ? 'Resume music' : 'Pause music'} disabled={!m.music.current} onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.music.setPaused(!m.music.paused); })}>{m.music.paused ? <Play /> : <Pause />}</button><button aria-label="Next song" disabled={!m.music.current} onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.music.next(); })}><SkipForward /></button></div></div></div>
        <div className="row queue-head"><h3>Up next</h3><div className="group"><button disabled={!m.music.current} onClick={() => m.engine?.music.reshuffleUpcoming()}><Shuffle />Reshuffle</button><button onClick={() => open('queue')} disabled={!m.music.current}>Full queue</button></div></div>
        <div className="songs">{m.music.upcoming.slice(0, 3).map(track)}</div>
        <div className="music-volume"><div className="row"><label className="muted" htmlFor="music-volume">Music volume</label><output>{Math.round(m.music.volume * 100)}%</output>{pendingMood && <button className="primary" onClick={() => void m.run(m.applyMood)}>Apply mood</button>}</div><input id="music-volume" type="range" min="0" max="100" value={Math.round(m.music.volume * 100)} onChange={event => { const volume = Number(event.target.value); m.engine?.music.setVolume(volume / 100); persist('music-volume', volume); }} /></div>
      </section>
    </main>
    <section className="shots" aria-label="Active scene one-shots"><div className="row"><div><h3>One-shots <span className="muted">· {m.active?.label ?? 'No active scene'}</span></h3></div><div className="group"><span className="muted">Tap to trigger</span><button onClick={() => open('shots')}>All one-shots & volume</button></div></div><div className="shot-grid">{m.active?.oneshots.slice(0, 5).map(shot)}{!m.active?.oneshots.length && <p className="muted">Choose one-shots in Edit scene. They become available after Apply.</p>}</div></section>
    <footer className="foot"><span role="status">{m.applying || m.music.transitioning ? 'Bringing in your changes…' : pending ? 'Changes prepared · current audio continues until Apply.' : 'Music continues independently when you change scenes.'}</span><div className="group">{pending && <button onClick={() => { m.cancelScene(); m.cancelMood(); }}>Cancel changes</button>}{pendingScene && pendingMood && <button className="primary" disabled={m.preparingMood} onClick={() => void m.run(applyAll)}>Apply all</button>}</div></footer>
    {picking && <SoundPicker title="Add ambiences" files={m.library.weather} categories={m.categories} selected={scene?.ambiences?.map(item => item.audioId) ?? []} onToggle={file => edit(draft => ({ ...draft, ambiences: draft.ambiences?.some(item => item.audioId === file.id) ? draft.ambiences.filter(item => item.audioId !== file.id) : [...(draft.ambiences ?? []), { audioId: file.id, volume: 35, enabled: true, audio: audioLayer(file) }] }))} onClose={() => setPicking(false)} />}
    {(m.error || m.music.error) && <div className="performance-error" role="alert"><span>{m.error || m.music.error}</span><button onClick={() => { setErrorDetail(m.error || m.music.error || ''); m.setError(''); open('settings'); }}>Details</button></div>}
    {popup && <Overlay title={{ scenes: 'Choose a scene', moods: 'Choose a mood', editor: 'Scene editor', ambiences: 'Scene ambiences', queue: 'Music queue', shots: 'One-shots', settings: 'Settings', library: 'Library' }[popup]} onClose={() => open(null)}>
      {(popup === 'scenes' || popup === 'moods') && <><label className="overlay-search">Search {popup}<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={`Find ${popup === 'scenes' ? 'a scene' : 'a mood'}…`} /></label><div className="choice-grid">{popup === 'scenes' ? Object.values(m.drafts.drafts).filter(item => item.label.toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.id} className="choice-tile" onClick={() => { m.selectScene(item.id); open(null); }}><strong>{item.label}</strong><small>{item.environment?.name ?? 'No environment'} · {item.ambiences?.length ?? 0} ambiences</small></button>) : m.tags.filter(item => item.name.toLowerCase().includes(search.toLowerCase())).map(item => <button key={item.id} className="choice-tile" onClick={() => { void m.prepareMood(String(item.id)); open(null); }}><strong>{item.name}</strong></button>)}</div>{popup === 'scenes' ? <button onClick={() => { m.createScene(); open('editor'); }}>＋ Create scene</button> : !m.tags.length && <p>No moods yet. Create music moods in Library.</p>}</>}
      {popup === 'editor' && <ScenePanel mixer={m} />}
      {popup === 'library' && <LibraryPanel mixer={m} />}
      {popup === 'ambiences' && <><p className="hint">Volume changes are immediate for active sounds. On/off changes wait for Apply.</p><div className="ambience-grid">{scene?.ambiences?.map(ambienceCard)}</div><button onClick={editScene}>Edit scene sounds</button></>}
      {popup === 'queue' && <><button onClick={() => m.engine?.music.reshuffleUpcoming()}>Shuffle upcoming</button><div className="full-queue">{m.music.upcoming.map(track)}</div></>}
      {popup === 'shots' && <><VolumeCard name="One-shots" volume={m.shotVolume} onChange={m.setShotVolume} /><div className="choice-grid full-shot-grid">{m.active?.oneshots.map(shot)}</div></>}
      {popup === 'settings' && <div className="performance-settings"><button onClick={() => open('library')}>Open Library · manage sounds & moods</button><label>Scene transition<select value={m.sceneDuration} onChange={event => m.setSceneDuration(Number(event.target.value))}>{[1, 3, 6, 10, 15].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label><label>Music transition<select value={m.musicDuration} onChange={event => m.setMusicDuration(Number(event.target.value))}>{[1, 3, 6, 10, 15].map(value => <option key={value} value={value}>{value} seconds</option>)}</select></label><VolumeCard name="One-shots" volume={m.shotVolume} onChange={m.setShotVolume} /><label className="wake-control"><input type="checkbox" checked={wake.enabled} onChange={event => wake.setEnabled(event.target.checked)} />Keep screen awake <small role="status">{wake.status}</small></label><button onClick={() => void m.run(m.unlock)}>Resume audio connection</button><button onClick={() => void m.run(m.refreshLibrary)}>Reload library</button>{(errorDetail || m.music.error) && <p className="error">{errorDetail || m.music.error}</p>}<p className="hint">Scene and mood choices wait for Apply. Editing and saving never start playback.</p></div>}
    </Overlay>}
  </div>;
}
