import type { Mixer } from './useMixer';
import { persist } from './useMixer';
import { VolumeCard } from './VolumeCard';
export function MusicPanel({ mixer: m }: { mixer: Mixer }) {
  const { music } = m;
  return <section className="panel music-panel" aria-labelledby="music-heading">
    <header className="section-head"><div><span className="eyebrow">THE SOUNDTRACK</span><h2 id="music-heading">Music & mood</h2></div><span className="badge">Independent</span></header>
    <label>Prepare a mood<select value={music.preparedMood?.id ?? ''} onChange={event => void m.prepareMood(event.target.value)} disabled={m.loading}>
      <option value="">Choose a mood…</option>{m.tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></label>
    {!m.tags.length && <p className="hint">Create moods and assign songs in Library.</p>}
    <div className="prepared-row" aria-live="polite">{m.preparingMood ? 'Loading mood…' : music.preparedMood ? `Prepared: ${music.preparedMood.name}` : 'No mood changes prepared'}</div>
    <div className="actions"><button className="primary" disabled={!music.preparedMood || m.preparingMood} onClick={() => void m.run(m.applyMood)}>{music.transitioning ? 'Applying…' : 'Apply mood'}</button><button disabled={!music.preparedMood && !m.preparingMood && !music.transitioning} onClick={m.cancelMood}>Cancel mood</button>
      <label className="duration">Fade<select aria-label="Music fade duration" value={m.musicDuration} onChange={event => m.setMusicDuration(Number(event.target.value))}>{[1, 3, 6, 10, 15].map(value => <option key={value} value={value}>{value}s</option>)}</select></label></div>
    <div className="now-playing"><span className="eyebrow">{music.paused ? 'PAUSED' : music.current ? 'NOW PLAYING' : 'READY WHEN YOU ARE'}</span><h3>{music.current?.name ?? 'No music playing'}</h3><p>{music.mood?.name ?? 'Prepare a mood, then Apply.'}</p>
      <div className="actions"><button disabled={!music.current} onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.music.setPaused(!music.paused); })}>{music.paused ? 'Resume music' : 'Pause music'}</button><button disabled={!music.current} onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.music.next(); })}>Next song →</button></div></div>
    <VolumeCard name="Music" volume={Math.round(music.volume * 100)} onChange={value => { m.engine?.music.setVolume(value / 100); persist('music-volume', value); }} />
    {music.error && <p role="alert" className="error">{music.error} Use Next or reapply a mood to retry.</p>}
    <div className="section-head queue-heading"><h3>Up next <span className="count">{music.upcoming.length}</span></h3><button disabled={!music.upcoming.length} onClick={() => m.engine?.music.reshuffleUpcoming()}>Shuffle upcoming</button></div>
    <ol className="queue">{music.upcoming.map((track, index) => <li key={track.id}><button onClick={() => void m.run(async () => { await m.unlock(); await m.engine?.music.selectTrack(track.id); })}><span className="track-number">{String(index + 1).padStart(2, '0')}</span><span>{track.name}</span><span aria-hidden="true">↗</span></button></li>)}</ol>
    {!music.upcoming.length && <p className="hint">{music.current ? 'The mood will shuffle and repeat when this song finishes.' : 'Your shuffled queue appears here after Apply.'}</p>}
  </section>;
}
