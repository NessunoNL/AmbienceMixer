import { useState, useEffect } from "react";
import { X, Plus, Tag, Trash2, Check } from "lucide-react";
import { theme } from "../theme";
import type { MusicTag, AudioLayer } from "../types";
import { api } from "../services/api";

interface MusicTagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  musicFiles: AudioLayer[];
  onTagsUpdated: () => void;
}

export function MusicTagManager({
  isOpen,
  onClose,
  musicFiles,
  onTagsUpdated,
}: MusicTagManagerProps) {
  const [allTags, setAllTags] = useState<MusicTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [selectedTag, setSelectedTag] = useState<MusicTag | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen]);

  const loadTags = async () => {
    try {
      const tags = await api.getAllMusicTags();
      setAllTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      setLoading(true);
      await api.createMusicTag(newTagName.trim());
      setNewTagName("");
      await loadTags();
      onTagsUpdated();
    } catch (error) {
      console.error("Failed to create tag:", error);
      alert("Failed to create tag. It may already exist.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    if (!confirm("Delete this tag? It will be removed from all music files.")) {
      return;
    }

    try {
      await api.deleteMusicTag(tagId);
      await loadTags();
      onTagsUpdated();
    } catch (error) {
      console.error("Failed to delete tag:", error);
      alert("Failed to delete tag.");
    }
  };

  const handleToggleFile = (fileId: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(fileId)) {
      newSelection.delete(fileId);
    } else {
      newSelection.add(fileId);
    }
    setSelectedFiles(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === musicFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(musicFiles.map(f => f.id)));
    }
  };

  const handleBulkAssignTag = async () => {
    if (!selectedTag || selectedFiles.size === 0) return;

    try {
      setLoading(true);
      const promises = Array.from(selectedFiles).map(fileId =>
        api.addTagToAudioFile(parseInt(fileId), selectedTag.id)
      );
      await Promise.all(promises);
      onTagsUpdated();
      setSelectedFiles(new Set());
      alert(`Tag "${selectedTag.name}" assigned to ${selectedFiles.size} file(s)`);
    } catch (error) {
      console.error("Failed to bulk assign tag:", error);
      alert("Failed to assign tags to some files");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRemoveTag = async () => {
    if (!selectedTag || selectedFiles.size === 0) return;

    try {
      setLoading(true);
      const promises = Array.from(selectedFiles).map(fileId =>
        api.removeTagFromAudioFile(parseInt(fileId), selectedTag.id)
      );
      await Promise.all(promises);
      onTagsUpdated();
      setSelectedFiles(new Set());
      alert(`Tag "${selectedTag.name}" removed from ${selectedFiles.size} file(s)`);
    } catch (error) {
      console.error("Failed to bulk remove tag:", error);
      alert("Failed to remove tags from some files");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl p-6"
        style={{ background: theme.card, color: theme.text }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Tag style={{ color: theme.primary }} className="w-5 h-5" />
            <h2 className="text-xl font-bold">Manage Music Tags</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg transition-colors"
            style={{ background: theme.bgSoft }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.bg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.bgSoft;
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Create New Tag */}
        <div className="mb-6 p-4 rounded-lg" style={{ background: theme.bgSoft }}>
          <h3 className="text-sm font-semibold mb-3">Create New Tag</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateTag();
              }}
              placeholder="Tag name..."
              className="flex-1 px-3 py-2 rounded-lg border-none outline-none"
              style={{ background: theme.card, color: theme.text }}
            />
            <button
              onClick={handleCreateTag}
              disabled={loading || !newTagName.trim()}
              className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
              style={{
                background: theme.primary,
                color: theme.bg,
                opacity: loading || !newTagName.trim() ? 0.5 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading && newTagName.trim()) {
                  e.currentTarget.style.opacity = "0.9";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && newTagName.trim()) {
                  e.currentTarget.style.opacity = "1";
                }
              }}
            >
              <Plus className="w-4 h-4" />
              Create
            </button>
          </div>
        </div>

        {/* Existing Tags */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Existing Tags</h3>
          {allTags.length === 0 ? (
            <p className="text-center py-4" style={{ color: theme.textMuted }}>
              No tags created yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                  style={{ background: theme.bgSoft }}
                >
                  <span>{tag.name}</span>
                  <button
                    onClick={() => handleDeleteTag(tag.id)}
                    className="p-0.5 rounded transition-colors"
                    style={{ color: theme.textMuted }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ff6b6b";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.textMuted;
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Assign Tags */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Bulk Assign Tags</h3>
          {musicFiles.length === 0 ? (
            <p className="text-center py-4" style={{ color: theme.textMuted }}>
              No music files found.
            </p>
          ) : allTags.length === 0 ? (
            <p className="text-center py-4" style={{ color: theme.textMuted }}>
              Create a tag first to assign it to files.
            </p>
          ) : (
            <>
              {/* Tag Selection */}
              <div className="mb-3 p-3 rounded-lg" style={{ background: theme.bgSoft }}>
                <label className="text-xs font-medium mb-2 block" style={{ color: theme.textMuted }}>
                  Select tag to assign:
                </label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTag(selectedTag?.id === tag.id ? null : tag)}
                      className="px-3 py-1.5 rounded-lg text-sm transition-colors"
                      style={{
                        background: selectedTag?.id === tag.id ? theme.primary : theme.card,
                        color: selectedTag?.id === tag.id ? theme.bg : theme.text,
                        border: `1px solid ${selectedTag?.id === tag.id ? theme.primary : theme.bgSoft}`,
                      }}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* File Selection */}
              {selectedTag && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: theme.textMuted }}>
                      Select files ({selectedFiles.size} selected):
                    </label>
                    <button
                      onClick={handleSelectAll}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{ background: theme.bgSoft, color: theme.primary }}
                    >
                      {selectedFiles.size === musicFiles.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>

                  <div className="space-y-1 max-h-64 overflow-y-auto mb-3">
                    {musicFiles.map((file) => {
                      const isSelected = selectedFiles.has(file.id);
                      const hasTag = file.tags?.some((t) => t.id === selectedTag.id);
                      return (
                        <div
                          key={file.id}
                          onClick={() => handleToggleFile(file.id)}
                          className="flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors"
                          style={{
                            background: isSelected ? theme.bgSoft : theme.bg,
                            border: `1px solid ${isSelected ? theme.primary : "transparent"}`,
                          }}
                        >
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isSelected ? theme.primary : theme.bgSoft,
                              color: theme.bg,
                              border: `1px solid ${isSelected ? theme.primary : theme.bgSoft}`,
                            }}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{file.name}</div>
                            {hasTag && (
                              <div className="text-xs" style={{ color: theme.primary }}>
                                Already has this tag
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bulk Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleBulkAssignTag}
                      disabled={loading || selectedFiles.size === 0}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                      style={{
                        background: theme.primary,
                        color: theme.bg,
                        opacity: loading || selectedFiles.size === 0 ? 0.5 : 1,
                      }}
                    >
                      Assign to {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}
                    </button>
                    <button
                      onClick={handleBulkRemoveTag}
                      disabled={loading || selectedFiles.size === 0}
                      className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
                      style={{
                        background: theme.bgSoft,
                        color: theme.text,
                        opacity: loading || selectedFiles.size === 0 ? 0.5 : 1,
                      }}
                    >
                      Remove from {selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""}
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
