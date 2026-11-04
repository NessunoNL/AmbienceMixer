import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';

interface Props { name: string; volume: number; maxVolume?: number; off?: boolean; status?: string; onChange: (volume: number) => void; children?: ReactNode }
export function VolumeCard({ name, volume, maxVolume = 100, off, status, onChange, children }: Props) {
  const displayedVolume = Math.round(volume * maxVolume / 100 * 10) / 10;
  const gesture = useRef<{ x: number; y: number; volume: number; direction?: 'x' | 'y' } | null>(null);
  const change = (value: number) => onChange(Math.round(Math.max(0, Math.min(100, value))));
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    if (!start) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!start.direction && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      start.direction = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (start.direction === 'x') event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (start.direction === 'x') change(start.volume + dx / event.currentTarget.clientWidth * 100);
  };
  const key = (event: KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 10, PageDown: -10 };
    if (event.key in steps || event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); change(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : volume + steps[event.key]);
    }
  };
  return <article className={`volume-card ${off ? 'off' : ''}`}>
    <div className="volume-fill" style={{ width: `${volume}%` }} />
    <div className="volume-gesture" role="slider" tabIndex={0} aria-label={`${name} volume`} aria-valuemin={0} aria-valuemax={maxVolume} aria-valuenow={displayedVolume} aria-valuetext={`${displayedVolume}%`} aria-orientation="horizontal"
      onKeyDown={key} onPointerDown={event => { if (event.button === 0) gesture.current = { x: event.clientX, y: event.clientY, volume }; }} onPointerMove={move} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }}>
      <div className="card-name">{name}</div><strong>{displayedVolume}%</strong>{status && <small>{status}</small>}
    </div>
    {children && <div className="card-actions">{children}</div>}
  </article>;
}
