import React from "react";
import { X } from "lucide-react";
import { theme } from "../theme";
import type { AudioLayer, LayerType } from "../types";

interface LayerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  layerType: LayerType;
  items: AudioLayer[];
  currentSelection?: AudioLayer | null;
  onSelect: (item: AudioLayer) => void;
}

export const LayerPicker: React.FC<LayerPickerProps> = ({
  isOpen,
  onClose,
  layerType,
  items,
  currentSelection,
  onSelect,
}) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const layerLabels = {
    environment: "Environment",
    weather: "Weather",
    music: "Music",
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
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl"
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
          <h2 className="text-lg font-semibold" style={{ color: theme.text }}>
            Select {layerLabels[layerType]}
          </h2>
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
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {items.length === 0 ? (
            <div className="text-center py-8" style={{ color: theme.textMuted }}>
              No {layerLabels[layerType].toLowerCase()} sounds available
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((item) => {
                const isSelected = currentSelection?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                    style={{
                      background: isSelected ? theme.primary : theme.card,
                      border: isSelected
                        ? `2px solid ${theme.primary}`
                        : "1px solid rgba(0, 0, 0, 0.25)",
                      color: isSelected ? theme.bg : theme.text,
                      boxShadow: isSelected
                        ? `0 0 0 3px rgba(167, 192, 128, 0.2)`
                        : "0 2px 6px rgba(0, 0, 0, 0.3)",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = theme.bgSoft;
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = theme.card;
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center"
                      style={{
                        background: isSelected
                          ? "rgba(0, 0, 0, 0.2)"
                          : theme.bgSoft,
                        border: "1px solid rgba(0, 0, 0, 0.25)",
                      }}
                    >
                      {item.thumb ? (
                        <img
                          src={item.thumb}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div
                          className="text-xs font-mono"
                          style={{
                            color: isSelected ? theme.text : theme.textMuted,
                          }}
                        >
                          {layerType[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div
                        className="text-xs mt-0.5"
                        style={{
                          color: isSelected ? theme.bg : theme.textMuted,
                          opacity: 0.8,
                        }}
                      >
                        {isSelected ? "Currently playing" : "Click to select"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
