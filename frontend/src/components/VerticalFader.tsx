import React, { useRef, useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { theme } from "../theme";

interface VerticalFaderProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  onChange: (value: number) => void;
  onMute?: () => void;
  onSolo?: () => void;
  muted?: boolean;
  soloed?: boolean;
}

export const VerticalFader: React.FC<VerticalFaderProps> = ({
  label,
  icon: Icon,
  value,
  onChange,
  onMute,
  muted,
}) => {
  const sliderRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientY: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const y = clientY - rect.top;
    const height = rect.height;
    const newValue = Math.max(0, Math.min(100, 100 - (y / height) * 100));
    onChange(Math.round(newValue));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -5 : 5; // Scroll down = decrease, scroll up = increase
    const newValue = Math.max(0, Math.min(100, value + delta));
    onChange(newValue);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) handleMove(e.clientY);
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  return (
    <div
      className="flex flex-col items-center gap-3 p-4 rounded-2xl"
      style={{
        background: theme.card,
        border: `1px solid rgba(0,0,0,0.25)`,
        boxShadow: "0 6px 14px rgba(0,0,0,0.4)",
      }}
    >
      <div className="flex items-center gap-2 font-medium" style={{ color: theme.text }}>
        <Icon className="w-5 h-5" />
        <span>{label}</span>
      </div>
      <div
        className="relative h-56 w-12 flex items-center justify-center"
        onWheel={handleWheel}
      >
        <div
          ref={trackRef}
          className="absolute left-1/2 -translate-x-1/2 h-48 w-10 rounded cursor-pointer flex items-center justify-center"
          onMouseDown={(e) => {
            setIsDragging(true);
            handleMove(e.clientY);
          }}
        >
          {/* Thin visual bar */}
          <div
            className="absolute left-1/2 -translate-x-1/2 h-full w-1.5 rounded pointer-events-none"
            style={{ background: "rgba(255,255,255,0.12)" }}
          />
          {/* Draggable knob */}
          <div
            className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full pointer-events-none"
            style={{
              top: `${100 - value}%`,
              transform: "translate(-50%, -50%)",
              background: theme.primary,
              boxShadow: "0 6px 14px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(255,255,255,0.15)",
            }}
          />
        </div>
        {[0, 25, 50, 75, 100].map((m) => (
          <div
            key={m}
            className="absolute right-0 text-[10px] pointer-events-none"
            style={{ top: `${8 + (100 - m) * 0.8}%`, color: theme.textMuted }}
          >
            {m}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-sm" style={{ color: theme.textMuted }}>
          {value}%
        </div>
        {onMute && (
          <button
            onClick={onMute}
            className="p-1 rounded transition-colors"
            style={{
              background: muted ? theme.accent : "transparent",
              color: muted ? theme.bg : theme.textMuted,
            }}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};
