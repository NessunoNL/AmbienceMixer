import React from "react";
import { theme } from "../theme";

interface LayerTileProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  selected?: { name: string; thumb?: string } | null;
  onPick?: () => void;
}

export const LayerTile: React.FC<LayerTileProps> = ({ label, icon: Icon, selected, onPick }) => (
  <button
    onClick={onPick}
    className="flex items-center gap-3 p-3 rounded-xl w-full transition-colors"
    style={{
      background: theme.card,
      border: `1px solid rgba(0,0,0,0.25)`,
      color: theme.text,
      boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
    }}
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
    </div>
    <div className="text-xs" style={{ color: theme.accent }}>
      Change
    </div>
  </button>
);
