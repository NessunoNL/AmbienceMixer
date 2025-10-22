import React, { useState, useMemo, useEffect } from "react";
import { X, Music, Shuffle, Tag as TagIcon, Plus } from "lucide-react";
import { theme } from "../theme";
import type { AudioLayer, LayerType, MusicTag } from "../types";
import { api } from "../services/api";

interface LayerPickerProps {
  isOpen: boolean;
  onClose: () => void;
  layerType: LayerType;
  items: AudioLayer[];
  currentSelection?: AudioLayer | null;
  onSelect: (item: AudioLayer | null) => void;
  onSelectTag?: (tag: MusicTag) => void;
  onTagsUpdated?: () => void;
}

export const LayerPicker: React.FC<LayerPickerProps> = ({
  isOpen,
  onClose,
  layerType,
  items,
  currentSelection,
  onSelect,
  onSelectTag,
  onTagsUpdated,
}) => {
  const [selectedTagFilter, setSelectedTagFilter] = useState<number | null>(null);
  const [musicPickerMode, setMusicPickerMode] = useState<"single" | "tag">("single");
  const [openTagDropdown, setOpenTagDropdown] = useState<string | null>(null);
  const [allAvailableTags, setAllAvailableTags] = useState<MusicTag[]>([]);
  const [newTagInput, setNewTagInput] = useState("");

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

  // Load all tags when picker opens (for music only)
  useEffect(() => {
    if (isOpen && layerType === "music") {
      loadAllTags();
    }
  }, [isOpen, layerType]);

  const loadAllTags = async () => {
    try {
      const tags = await api.getAllMusicTags();
      setAllAvailableTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  // Handle tag toggle
  const handleToggleTag = async (fileId: string, tagId: number, hasTag: boolean) => {
    try {
      if (hasTag) {
        await api.removeTagFromAudioFile(parseInt(fileId), tagId);
      } else {
        await api.addTagToAudioFile(parseInt(fileId), tagId);
      }
      if (onTagsUpdated) {
        onTagsUpdated();
      }
      await loadAllTags();
    } catch (error) {
      console.error("Failed to toggle tag:", error);
    }
  };

  // Handle inline tag creation
  const handleCreateAndAssignTag = async (fileId: string) => {
    if (!newTagInput.trim()) return;

    try {
      const result = await api.createMusicTag(newTagInput.trim());
      await api.addTagToAudioFile(parseInt(fileId), result.tag.id);
      setNewTagInput("");
      if (onTagsUpdated) {
        onTagsUpdated();
      }
      await loadAllTags();
    } catch (error) {
      console.error("Failed to create and assign tag:", error);
      alert("Failed to create tag. It may already exist.");
    }
  };

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
                const isDropdownOpen = openTagDropdown === item.id;
                return (
                  <div
                    key={item.id}
                    className="relative rounded-xl transition-all"
                    style={{
                      background: isSelected ? theme.primary : theme.card,
                      border: isSelected
                        ? `2px solid ${theme.primary}`
                        : "1px solid rgba(0, 0, 0, 0.25)",
                      color: isSelected ? theme.bg : theme.text,
                      boxShadow: isSelected
                        ? `0 0 0 3px rgba(167, 192, 128, 0.2)`
                        : "0 2px 6px rgba(0, 0, 0, 0.3)",
                      zIndex: isDropdownOpen ? 100 : 1,
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
                    <button
                      onClick={() => {
                        onSelect(item);
                        onClose();
                      }}
                      className="flex items-center gap-3 p-3 w-full text-left"
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
                        </div>
                      </div>
                    </button>

                    {/* Tag management section (music only) */}
                    {layerType === "music" && (
                      <div className="px-3 pb-3 pt-0 flex items-center gap-2 flex-wrap">
                        {/* Existing tags */}
                        {item.tags && item.tags.length > 0 && item.tags.map((tag) => (
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

                        {/* Tag button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenTagDropdown(isDropdownOpen ? null : item.id);
                          }}
                          className="p-1 rounded transition-colors"
                          style={{
                            background: isDropdownOpen ? theme.primary : "transparent",
                            color: isDropdownOpen ? theme.bg : (isSelected ? theme.bg : theme.textMuted),
                          }}
                          title="Manage tags"
                        >
                          <TagIcon className="w-3 h-3" />
                        </button>

                        {/* Tag dropdown */}
                        {isDropdownOpen && (
                          <div
                            className="absolute left-3 right-3 mt-1 p-2 rounded-lg shadow-lg z-50"
                            style={{
                              background: theme.card,
                              border: `1px solid ${theme.bgSoft}`,
                              maxHeight: "200px",
                              overflowY: "auto",
                              top: "100%",
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="text-xs font-semibold mb-2" style={{ color: theme.text }}>
                              Tags for {item.name}
                            </div>

                            {/* Tag checkboxes */}
                            {allAvailableTags.length > 0 ? (
                              <div className="space-y-1">
                                {allAvailableTags.map((tag) => {
                                  const hasTag = item.tags?.some(t => t.id === tag.id) || false;
                                  return (
                                    <label
                                      key={tag.id}
                                      className="flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-opacity-50"
                                      style={{ background: hasTag ? theme.bgSoft : "transparent" }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={hasTag}
                                        onChange={() => handleToggleTag(item.id, tag.id, hasTag)}
                                        className="w-3 h-3"
                                      />
                                      <span className="text-xs" style={{ color: theme.text }}>
                                        {tag.name}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs py-2" style={{ color: theme.textMuted }}>
                                No tags available. Create one below.
                              </div>
                            )}

                            {/* Create new tag */}
                            <div className="mt-2 pt-2 border-t" style={{ borderColor: theme.bgSoft }}>
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={newTagInput}
                                  onChange={(e) => setNewTagInput(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleCreateAndAssignTag(item.id);
                                    } else if (e.key === "Escape") {
                                      setOpenTagDropdown(null);
                                    }
                                  }}
                                  placeholder="New tag..."
                                  className="flex-1 px-2 py-1 text-xs rounded border-none outline-none"
                                  style={{ background: theme.bgSoft, color: theme.text }}
                                />
                                <button
                                  onClick={() => handleCreateAndAssignTag(item.id)}
                                  className="p-1 rounded"
                                  style={{ background: theme.primary, color: theme.bg }}
                                  title="Create and assign"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Non-music: show selection text */}
                    {layerType !== "music" && (
                      <div className="px-3 pb-3 text-xs" style={{ color: isSelected ? theme.bg : theme.textMuted }}>
                        {isSelected ? "Currently playing" : "Click to select"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
