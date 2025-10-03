import React from "react";
import { theme } from "../theme";

interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export const Section: React.FC<SectionProps> = ({ children, className = "" }) => (
  <div
    className={`rounded-2xl border ${className}`}
    style={{
      background: theme.card,
      border: `1px solid rgba(0,0,0,0.25)`,
      boxShadow: "0 4px 12px rgba(0,0,0,0.35)",
    }}
  >
    {children}
  </div>
);
