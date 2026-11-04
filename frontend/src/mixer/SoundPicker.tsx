import { useEffect, useRef, useState } from 'react';
import type { AudioFile, SoundCategory } from '../services/api';

export function SoundPicker({ title, files, categories, selected, onToggle, onClose }: {
  title: string; files: AudioFile[]; categories: SoundCategory[]; selected: number[]; onToggle: (file: AudioFile) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all');
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current!; element.showModal(); searchInput.current?.focus();
    return () => { element.close(); previous?.focus(); };
  }, []);
  const results = files.filter(file => file.name.toLowerCase().includes(search.toLowerCase()) &&
    (category === 'all' || (category === 'none' ? !file.soundCategoryId : file.soundCategoryId === Number(category))));
  return <dialog ref={dialog} className="sound-sheet" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="picker-title">
    <header><div><span className="eyebrow">SCENE SOUNDS</span><h2 id="picker-title">{title}</h2></div><button onClick={onClose} aria-label="Close sound picker">×</button></header>
    <div className="picker-filters"><label>Search sounds<input ref={searchInput} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your library…" /></label>
      <div className="sheet-filters" aria-label="Sound categories">{[{ id: 'all', name: 'All' }, { id: 'none', name: 'Uncategorized' }, ...categories.map(item => ({ id: String(item.id), name: item.name }))].map(item => <button key={item.id} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.name}</button>)}</div></div>
    <div className="picker-results">{results.length ? results.map(file => <label className="picker-item" key={file.id}><input type="checkbox" checked={selected.includes(file.id)} onChange={() => onToggle(file)} /><span>{file.name}<small>{file.soundCategory?.name ?? 'Uncategorized'}</small></span></label>) : <p className="empty">No sounds match. Try another search or category.</p>}</div>
    <footer><span>{selected.length} selected · Changes are prepared</span><button className="primary" onClick={onClose}>Done</button></footer>
  </dialog>;
}
