import React from "react";
import { theme } from "../theme";

interface OneShotButtonProps {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  onTrigger: () => void;
}

export const OneShotButton: React.FC<OneShotButtonProps> = ({ name, icon: Icon, onTrigger }) => (
  <button
    onClick={onTrigger}
    className="flex items-center gap-2 p-3 rounded-xl transition-all active:scale-95"
    style={{
      background: theme.card,
      border: "1px solid rgba(0,0,0,0.25)",
      color: theme.text,
      boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
    }}
  >
    <Icon className="w-4 h-4" />
    <span className="text-sm">{name}</span>
  </button>
);
