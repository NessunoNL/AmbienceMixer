import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';

export function Overlay({ title, children, onClose, footer }: { title: string; children: ReactNode; onClose: () => void; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null, dialog = ref.current!;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="mixer-overlay" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2 id={titleId}>{title}</h2><button onClick={onClose} aria-label={`Close ${title}`}>×</button></header>
    <div className="overlay-body">{children}</div>
    <footer>{footer}<button onClick={onClose}>Done</button></footer>
  </dialog>;
}
