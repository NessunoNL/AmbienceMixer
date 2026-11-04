import { useState } from 'react';
import { api } from '../services/api';
import type { ScanResult } from '../services/api';
import type { Mixer } from './useMixer';
import { MusicTagManager } from '../components/MusicTagManager';
import { audioLayer } from './libraryAudio';
export function LibraryPanel({ mixer: m }: { mixer: Mixer }) {
  const [name, setName] = useState(''), [search, setSearch] = useState(''), [kind, setKind] = useState<'weather' | 'oneshots'>('weather');
  const [busy, setBusy] = useState(false), [scan, setScan] = useState<ScanResult>(), [manageMoods, setManageMoods] = useState(false);
  const operation = async (action: () => Promise<unknown>) => {
    setBusy(true);
    await m.run(async () => { await action(); await m.refreshLibrary(); });
    setBusy(false);
  };
  return <section className="panel library-panel"><header className="section-head"><div><span className="eyebrow">YOUR COLLECTION</span><h2>Library</h2></div><button disabled={busy} onClick={() => void operation(async () => setScan(await api.triggerAudioScan()))}>{busy ? 'Working…' : 'Rescan audio'}</button></header>
    <p className="hint">{m.library.environment.length} environments · {m.library.weather.length} ambiences · {m.library.music.length} songs · {m.library.oneshots.length} one-shots</p>
    {scan && <div role="status" className={scan.partial ? 'error' : 'notice'}>{scan.partial ? 'Scan partly completed. Some existing records were retained.' : `Scan complete: ${scan.totalFiles} files.`}{scan.warnings.map((warning, index) => <p key={index}>{warning.category}: {warning.file} {warning.message}</p>)}</div>}
    <div className="section-head"><h3>Music moods</h3><button onClick={() => setManageMoods(true)}>Manage moods & song assignments</button></div>
    <p className="hint">Moods reuse your existing music tags. Scene changes leave music playing.</p>
    <div className="category-list">{m.tags.map(tag => <div key={tag.id}><span>{tag.name}</span><button disabled={busy} onClick={() => { const next = prompt('Rename mood', tag.name); if (next?.trim()) void operation(() => api.updateMusicTag(tag.id, next.trim(), tag.color)); }}>Rename mood</button></div>)}</div>
    <h3>Sound categories</h3><form className="actions" onSubmit={event => { event.preventDefault(); if (name.trim()) void operation(async () => { await api.createSoundCategory(name.trim()); setName(''); }); }}><input aria-label="New category name" placeholder="New category name" value={name} onChange={event => setName(event.target.value)} /><button disabled={busy || !name.trim()}>Create category</button></form>
    <div className="category-list">{m.categories.map(category => <div key={category.id}><span>{category.name}</span><button disabled={busy} onClick={() => { const next = prompt('Rename category', category.name); if (next?.trim()) void operation(() => api.renameSoundCategory(category.id, next.trim())); }}>Rename</button><button disabled={busy} onClick={() => { if (confirm(`Delete “${category.name}”? Sounds remain in your library, uncategorized.`)) void operation(() => api.deleteSoundCategory(category.id)); }}>Delete</button></div>)}</div>
    <div className="picker-filters"><label>Sounds<select value={kind} onChange={event => setKind(event.target.value as typeof kind)}><option value="weather">Ambiences</option><option value="oneshots">One-shots</option></select></label><label>Search library<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    <div className="library-files">{m.library[kind].filter(file => file.name.toLowerCase().includes(search.toLowerCase())).map(file => <div key={file.id}><span>{file.name}</span><select aria-label={`Category for ${file.name}`} disabled={busy} value={file.soundCategoryId ?? ''} onChange={event => void operation(() => api.assignSoundCategory(file.id, event.target.value ? Number(event.target.value) : null))}><option value="">Uncategorized</option>{m.categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>)}</div>
    <MusicTagManager isOpen={manageMoods} onClose={() => setManageMoods(false)} musicFiles={m.library.music.map(audioLayer)} onTagsUpdated={() => void m.run(m.refreshLibrary)} />
  </section>;
}
