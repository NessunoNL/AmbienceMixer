import React, { useState } from "react";
import { X, Volume2 } from "lucide-react";
import { theme } from "../theme";
import type { AudioLayer, OneShot } from "../types";

interface OneShotPickerProps {
  isOpen: boolean;
  onClose: () => void;
  availableOneShots: AudioLayer[];
  currentSelection: OneShot[];
  onApply: (selectedOneShots: OneShot[]) => void;
  temporary?: boolean;
}

export const OneShotPicker: React.FC<OneShotPickerProps> = ({
  isOpen,
  onClose,
  availableOneShots,
  currentSelection,
  onApply,
  temporary = false,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentSelection.map((os) => os.id)
  );

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const toggleOneShot = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    const selected = availableOneShots
      .filter((os) => selectedIds.includes(os.id))
      .map((os) => ({
        id: os.id,
        name: os.name,
        url: os.url,
        icon: "Volume2",
      }));
    onApply(selected);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          background: theme.bg,
          border: `1px solid rgba(255, 255, 255, 0.1)`,
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
            background: theme.bgSoft,
          }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
              {temporary ? "Customize One-Shots" : "Select One-Shots"}
            </h2>
            {temporary && (
              <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
                Changes will apply temporarily (not saved to scene)
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{
              background: "transparent",
              color: theme.textMuted,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.card;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {availableOneShots.length === 0 ? (
            <div className="text-center py-8" style={{ color: theme.textMuted }}>
              No one-shot audio files found. Add files to /audio/oneshots/ and rescan.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableOneShots.map((oneShot) => {
                const isSelected = selectedIds.includes(oneShot.id);
                return (
                  <button
                    key={oneShot.id}
                    onClick={() => toggleOneShot(oneShot.id)}
                    className="flex items-center gap-2 p-2 rounded-lg text-left transition-all text-sm"
                    style={{
                      background: isSelected ? theme.primary : theme.card,
                      border: isSelected
                        ? `2px solid ${theme.primary}`
                        : "1px solid rgba(0, 0, 0, 0.25)",
                      color: isSelected ? theme.bg : theme.text,
                    }}
                  >
                    <Volume2 className="w-4 h-4 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{oneShot.name}</div>
                      {oneShot.duration && (
                        <div
                          className="text-xs truncate"
                          style={{
                            color: isSelected ? theme.bg : theme.textMuted,
                            opacity: 0.8,
                          }}
                        >
                          {Math.floor(oneShot.duration / 60)}:
                          {Math.floor(oneShot.duration % 60)
                            .toString()
                            .padStart(2, "0")}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex gap-3"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
            background: theme.bgSoft,
          }}
        >
          <button
            onClick={handleApply}
            className="flex-1 p-3 rounded-xl font-semibold transition-all"
            style={{
              background: theme.primary,
              color: theme.bg,
            }}
          >
            Apply ({selectedIds.length} selected)
          </button>
          <button
            onClick={onClose}
            className="px-6 p-3 rounded-xl transition-all"
            style={{
              background: theme.card,
              color: theme.text,
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
