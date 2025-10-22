import React, { useState, useMemo } from "react";
import { X, Music, Shuffle } from "lucide-react";
import { theme } from "../theme";
import type { AudioLayer, LayerType, MusicTag } from "../types";

interface LayerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  layerType: LayerType;
  items: AudioLayer[];
  currentSelection?: AudioLayer | null;
  onSelect: (item: AudioLayer | null) => void;
  onSelectTag?: (tag: MusicTag) => void;
}

export const LayerPicker: React.FC<LayerPickerProps> = ({
  isOpen,
  onClose,
  layerType,
  items,
  currentSelection,
  onSelect,
  onSelectTag,
}) => {
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | null>(null);
  const [musicPickerMode, setMusicPickerMode] = useState<"single" | "tag">("single");

  // Extract all unique tags from music items
  const allTags = useMemo(() => {
    if (layerType !== "music") return [];
    const tagMap = new Map<number, MusicTag>();
    items.forEach((item) => {
      item.tags?.forEach((tag) => {
        tagMap.set(tag.id, tag);
      });
    });
    return Array.from(tagMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, layerType]);

  // Filter items by selected tag
  const filteredItems = useMemo(() => {
    if (layerType !== "music" || selectedTagFilter === null) {
      return items;
    }
    return items.filter((item) => item.tags?.some((tag) => tag.id === selectedTagFilter));
  }, [items, selectedTagFilter, layerType]);

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
          className="p-4 border-b"
          style={{
            borderColor: "rgba(255, 255, 255, 0.1)",
            background: theme.bgSoft,
          }}
        >
          <div className="flex items-center justify-between mb-3">
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

          {/* Music Mode Toggle */}
          {layerType === "music" && allTags.length > 0 && (
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setMusicPickerMode("single")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: musicPickerMode === "single" ? theme.primary : theme.card,
                  color: musicPickerMode === "single" ? theme.bg : theme.text,
                  border: `1px solid ${musicPickerMode === "single" ? theme.primary : "rgba(0,0,0,0.25)"}`,
                }}
              >
                <Music className="w-4 h-4" />
                Single Track
              </button>
              <button
                onClick={() => setMusicPickerMode("tag")}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: musicPickerMode === "tag" ? theme.primary : theme.card,
                  color: musicPickerMode === "tag" ? theme.bg : theme.text,
                  border: `1px solid ${musicPickerMode === "tag" ? theme.primary : "rgba(0,0,0,0.25)"}`,
                }}
              >
                <Shuffle className="w-4 h-4" />
                Tag Playlist
              </button>
            </div>
          )}

          {/* Tag Filter (only for music in single mode) */}
          {layerType === "music" && musicPickerMode === "single" && allTags.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setSelectedTagFilter(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: selectedTagFilter === null ? theme.primary : theme.card,
                  color: selectedTagFilter === null ? theme.bg : theme.text,
                  border: `1px solid ${selectedTagFilter === null ? theme.primary : "rgba(0,0,0,0.25)"}`,
                }}
              >
                All
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagFilter(tag.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: selectedTagFilter === tag.id ? theme.primary : theme.card,
                    color: selectedTagFilter === tag.id ? theme.bg : theme.text,
                    border: `1px solid ${selectedTagFilter === tag.id ? theme.primary : "rgba(0,0,0,0.25)"}`,
                  }}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {layerType === "music" && musicPickerMode === "tag" ? (
            /* Tag Selection View */
            allTags.length === 0 ? (
              <div className="text-center py-8" style={{ color: theme.textMuted }}>
                No tags available. Create tags in the tag manager.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allTags.map((tag) => {
                  const fileCount = items.filter(item =>
                    item.tags?.some(t => t.id === tag.id)
                  ).length;

                  return (
                    <button
                      key={tag.id}
                      onClick={() => {
                        if (onSelectTag) {
                          onSelectTag(tag);
                          onClose();
                        }
                      }}
                      className="flex items-center gap-3 p-4 rounded-xl transition-all text-left"
                      style={{
                        background: theme.card,
                        border: "1px solid rgba(0, 0, 0, 0.25)",
                        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = theme.bgSoft;
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = theme.card;
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center"
                        style={{
                          background: theme.primary,
                          color: theme.bg,
                        }}
                      >
                        <Shuffle className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-base">{tag.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                          {fileCount} track{fileCount !== 1 ? "s" : ""} • Shuffle playlist
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-8" style={{ color: theme.textMuted }}>
              {selectedTagFilter
                ? "No music files with this tag"
                : `No ${layerLabels[layerType].toLowerCase()} sounds available`}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* No Sound Option */}
              <button
                onClick={() => {
                  onSelect(null);
                  onClose();
                }}
                className="flex items-center gap-3 p-3 rounded-xl transition-all text-left"
                style={{
                  background: !currentSelection ? theme.primary : theme.card,
                  border: !currentSelection
                    ? `2px solid ${theme.primary}`
                    : "1px solid rgba(0, 0, 0, 0.25)",
                  color: !currentSelection ? theme.bg : theme.text,
                  boxShadow: !currentSelection
                    ? `0 0 0 3px rgba(167, 192, 128, 0.2)`
                    : "0 2px 6px rgba(0, 0, 0, 0.3)",
                }}
                onMouseEnter={(e) => {
                  if (currentSelection) {
                    e.currentTarget.style.background = theme.bgSoft;
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentSelection) {
                    e.currentTarget.style.background = theme.card;
                    e.currentTarget.style.transform = "translateY(0)";
                  }
                }}
              >
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{
                    background: !currentSelection
                      ? "rgba(0, 0, 0, 0.2)"
                      : theme.bgSoft,
                    border: "1px solid rgba(0, 0, 0, 0.25)",
                  }}
                >
                  <div
                    className="text-2xl"
                    style={{
                      color: !currentSelection ? theme.text : theme.textMuted,
                    }}
                  >
                    ∅
                  </div>
                </div>
                <div className="flex-1">
                  <div className="font-medium">No Sound</div>
                  <div
                    className="text-xs mt-0.5"
                    style={{
                      color: !currentSelection ? theme.bg : theme.textMuted,
                      opacity: 0.8,
                    }}
                  >
                    {!currentSelection ? "Currently silent" : "Click to select"}
                  </div>
                </div>
              </button>

              {filteredItems.map((item) => {
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
                        className="text-xs mt-0.5 space-y-0.5"
                        style={{
                          color: isSelected ? theme.bg : theme.textMuted,
                          opacity: 0.8,
                        }}
                      >
                        <div className="flex gap-2">
                          {item.duration && (
                            <span>
                              {Math.floor(item.duration / 60)}:
                              {Math.floor(item.duration % 60)
                                .toString()
                                .padStart(2, "0")}
                            </span>
                          )}
                          {item.format && <span>• {item.format.toUpperCase()}</span>}
                        </div>
                        {/* Show tags for music */}
                        {layerType === "music" && item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.tags.map((tag) => (
                              <span
                                key={tag.id}
                                className="px-1.5 py-0.5 rounded text-[10px]"
                                style={{
                                  background: isSelected
                                    ? "rgba(0, 0, 0, 0.2)"
                                    : theme.bgSoft,
                                  border: `1px solid ${isSelected ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.25)"}`,
                                }}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <div>{isSelected ? "Currently playing" : "Click to select"}</div>
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
