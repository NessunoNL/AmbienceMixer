import { useState, useEffect } from "react";
import { X, Plus, Tag, Trash2 } from "lucide-react";
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
  const [selectedFile, setSelectedFile] = useState<AudioLayer | null>(null);
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

  const handleToggleTag = async (file: AudioLayer, tag: MusicTag) => {
    const hasTag = file.tags?.some((t) => t.id === tag.id);
    const fileId = parseInt(file.id);

    try {
      if (hasTag) {
        await api.removeTagFromAudioFile(fileId, tag.id);
      } else {
        await api.addTagToAudioFile(fileId, tag.id);
      }
      onTagsUpdated();
    } catch (error) {
      console.error("Failed to toggle tag:", error);
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

        {/* Assign Tags to Music Files */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Assign Tags to Music</h3>
          {musicFiles.length === 0 ? (
            <p className="text-center py-4" style={{ color: theme.textMuted }}>
              No music files found.
            </p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {musicFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-lg"
                  style={{
                    background: selectedFile?.id === file.id ? theme.bgSoft : theme.bg,
                  }}
                >
                  <div
                    className="flex items-center justify-between mb-2 cursor-pointer"
                    onClick={() =>
                      setSelectedFile(selectedFile?.id === file.id ? null : file)
                    }
                  >
                    <span className="font-medium">{file.name}</span>
                    <span className="text-xs" style={{ color: theme.textMuted }}>
                      {file.tags?.length || 0} tags
                    </span>
                  </div>

                  {selectedFile?.id === file.id && allTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t" style={{ borderColor: theme.bgSoft }}>
                      {allTags.map((tag) => {
                        const hasTag = file.tags?.some((t) => t.id === tag.id);
                        return (
                          <button
                            key={tag.id}
                            onClick={() => handleToggleTag(file, tag)}
                            className="px-2 py-1 rounded text-xs transition-colors"
                            style={{
                              background: hasTag ? theme.primary : theme.card,
                              color: hasTag ? theme.bg : theme.text,
                              border: `1px solid ${hasTag ? theme.primary : theme.bgSoft}`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = "0.8";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = "1";
                            }}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
