import { Repeat, Shuffle, SkipForward } from "lucide-react";
import { theme } from "../theme";
import type { MusicTag } from "../types";

interface MusicModeSelectorProps {
  mode: "single-loop" | "tag-shuffle";
  selectedTag: MusicTag | null;
  availableTags: MusicTag[];
  currentTrack?: { name: string; index: number; total: number } | null;
  onModeChange: (mode: "single-loop" | "tag-shuffle") => void;
  onTagSelect: (tag: MusicTag | null) => void;
  onSkipTrack?: () => void;
}

export function MusicModeSelector({
  mode,
  selectedTag,
  availableTags,
  currentTrack,
  onModeChange,
  onTagSelect,
  onSkipTrack,
}: MusicModeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => onModeChange("single-loop")}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: mode === "single-loop" ? theme.primary : theme.bgSoft,
            color: mode === "single-loop" ? theme.bg : theme.text,
            border: `1px solid ${mode === "single-loop" ? theme.primary : "rgba(0,0,0,0.25)"}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          <Repeat className="w-4 h-4" />
          Single Loop
        </button>

        <button
          onClick={() => onModeChange("tag-shuffle")}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: mode === "tag-shuffle" ? theme.primary : theme.bgSoft,
            color: mode === "tag-shuffle" ? theme.bg : theme.text,
            border: `1px solid ${mode === "tag-shuffle" ? theme.primary : "rgba(0,0,0,0.25)"}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          <Shuffle className="w-4 h-4" />
          Tag Shuffle
        </button>
      </div>

      {/* Tag Selection (only show in tag-shuffle mode) */}
      {mode === "tag-shuffle" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: theme.textMuted }}>
            Select Tag:
          </label>
          <select
            value={selectedTag?.id || ""}
            onChange={(e) => {
              const tagId = parseInt(e.target.value);
              const tag = availableTags.find((t) => t.id === tagId) || null;
              onTagSelect(tag);
            }}
            className="px-3 py-2 rounded-lg text-sm border-none outline-none"
            style={{ background: theme.bgSoft, color: theme.text }}
          >
            <option value="">Select a tag...</option>
            {availableTags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Current Track Info (only show in tag-shuffle mode with active playlist) */}
      {mode === "tag-shuffle" && currentTrack && (
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg text-sm"
          style={{ background: theme.bgSoft }}
        >
          <div className="flex-1 truncate">
            <div className="font-medium truncate">{currentTrack.name}</div>
            <div className="text-xs" style={{ color: theme.textMuted }}>
              Track {currentTrack.index + 1} of {currentTrack.total}
            </div>
          </div>
          {onSkipTrack && (
            <button
              onClick={onSkipTrack}
              className="ml-2 p-1.5 rounded transition-colors"
              style={{ background: theme.card }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.bg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.card;
              }}
              title="Skip to next track"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
