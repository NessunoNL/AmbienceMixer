import React from "react";
import { theme } from "../theme";

interface SceneChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export const SceneChip: React.FC<SceneChipProps> = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors border"
    style={{
      color: active ? theme.bg : theme.text,
      background: active ? theme.primary : theme.bgSoft,
      borderColor: active ? theme.primary : "rgba(0,0,0,0.3)",
      boxShadow: active ? "0 2px 6px rgba(0,0,0,0.35)" : "none",
    }}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);
