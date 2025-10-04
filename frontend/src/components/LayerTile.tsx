import React from "react";
import { theme } from "../theme";

interface LayerTileProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  selected?: { name: string; thumb?: string } | null;
  queued?: { layer: { name: string; thumb?: string } | null; duration: number } | undefined;
  defaultDuration: number;
  onPick?: () => void;
  onDurationChange?: (duration: number) => void;
}

export const LayerTile: React.FC<LayerTileProps> = ({
  label,
  icon: Icon,
  selected,
  queued,
  defaultDuration,
  onPick,
  onDurationChange
}) => {
  const hasQueuedValue = queued !== undefined;
  const isQueuedNull = queued?.layer === null;

  const presets = [
    { label: "Quick", value: 0.5 },
    { label: "Normal", value: defaultDuration },
    { label: "Long", value: 6.0 },
  ];

  return (
    <div
      className="rounded-xl w-full transition-colors"
      style={{
        background: theme.card,
        border: hasQueuedValue ? `2px solid ${theme.accent}` : `1px solid rgba(0,0,0,0.25)`,
        color: theme.text,
        boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
      }}
    >
      <button
        onClick={onPick}
        className="flex items-center gap-3 p-3 w-full transition-colors"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden"
          style={{
            background: theme.bgSoft,
            border: `1px solid rgba(0,0,0,0.25)`,
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          {selected?.thumb ? (
            <img src={selected.thumb} alt={selected.name} className="w-full h-full object-cover" />
          ) : (
            <Icon className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs opacity-80" style={{ color: theme.textMuted }}>
            {selected ? selected.name : "No selection yet"}
          </div>
          {hasQueuedValue && (
            <div className="text-xs mt-1" style={{ color: theme.accent }}>
              Queued: {isQueuedNull ? "No Sound" : queued.layer?.name}
            </div>
          )}
        </div>
        <div className="text-xs" style={{ color: theme.accent }}>
          Change
        </div>
      </button>

      {/* Crossfade Duration Presets */}
      {hasQueuedValue && onDurationChange && (
        <div
          className="px-3 pb-3 pt-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-xs mb-1.5" style={{ color: theme.textMuted }}>
            Crossfade:
          </div>
          <div className="flex gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => onDurationChange(preset.value)}
                className="flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all"
                style={{
                  background: queued.duration === preset.value ? theme.accent : theme.bgSoft,
                  color: queued.duration === preset.value ? theme.bg : theme.text,
                  border: `1px solid ${queued.duration === preset.value ? theme.accent : 'rgba(0,0,0,0.25)'}`,
                }}
              >
                {preset.label}
                <div className="text-[10px] opacity-70 mt-0.5">
                  {preset.value}s
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
