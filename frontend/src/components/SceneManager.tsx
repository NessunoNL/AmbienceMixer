import React, { useState } from "react";
import { X, Plus, Edit2, Trash2, Save } from "lucide-react";
import { theme } from "../theme";
import type { Scene, AudioLayer } from "../types";
import { iconMap, oneShotLibrary } from "../mockData";

interface SceneManagerProps {
  isOpen: boolean;
  onClose: () => void;
  scenes: Scene[];
  currentLayers: {
    environment?: AudioLayer | null;
    weather?: AudioLayer | null;
    music?: AudioLayer | null;
  };
  onSaveScene: (scene: Scene) => void;
  onDeleteScene: (sceneId: string) => void;
}

type EditMode = "none" | "create" | "edit";

export const SceneManager: React.FC<SceneManagerProps> = ({
  isOpen,
  onClose,
  scenes,
  currentLayers,
  onSaveScene,
  onDeleteScene,
}) => {
  const [editMode, setEditMode] = useState<EditMode>("none");
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    icon: "Castle",
    selectedOneShots: [] as string[],
  });

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const startCreate = () => {
    setEditMode("create");
    setFormData({
      label: "New Scene",
      icon: "Castle",
      selectedOneShots: [],
    });
  };

  const startEdit = (scene: Scene) => {
    setEditMode("edit");
    setEditingScene(scene);
    setFormData({
      label: scene.label,
      icon: scene.icon,
      selectedOneShots: scene.oneshots.map((os) => os.id),
    });
  };

  const cancelEdit = () => {
    setEditMode("none");
    setEditingScene(null);
    setFormData({ label: "", icon: "Castle", selectedOneShots: [] });
  };

  const saveScene = () => {
    const selectedOneShots = oneShotLibrary.filter((os) =>
      formData.selectedOneShots.includes(os.id)
    );

    const newScene: Scene = {
      id: editMode === "create" ? `scene-${Date.now()}` : editingScene!.id,
      label: formData.label,
      icon: formData.icon,
      environment: currentLayers.environment,
      weather: currentLayers.weather,
      music: currentLayers.music,
      oneshots: selectedOneShots,
    };

    onSaveScene(newScene);
    cancelEdit();
  };

  const toggleOneShot = (oneShotId: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedOneShots: prev.selectedOneShots.includes(oneShotId)
        ? prev.selectedOneShots.filter((id) => id !== oneShotId)
        : [...prev.selectedOneShots, oneShotId],
    }));
  };

  const availableIcons = Object.keys(iconMap);

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
        className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl flex flex-col"
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
            {editMode === "none"
              ? "Scene Manager"
              : editMode === "create"
              ? "Create New Scene"
              : "Edit Scene"}
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
        <div className="flex-1 overflow-y-auto p-4">
          {editMode === "none" ? (
            <>
              {/* Scene List */}
              <button
                onClick={startCreate}
                className="w-full flex items-center justify-center gap-2 p-3 mb-4 rounded-xl transition-all"
                style={{
                  background: theme.primary,
                  color: theme.bg,
                  border: "none",
                  fontWeight: 600,
                }}
              >
                <Plus className="w-5 h-5" />
                Create New Scene
              </button>

              <div className="space-y-2">
                {scenes.map((scene) => {
                  const SceneIcon = iconMap[scene.icon];
                  return (
                    <div
                      key={scene.id}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{
                        background: theme.card,
                        border: "1px solid rgba(0, 0, 0, 0.25)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: theme.bgSoft,
                          border: "1px solid rgba(0, 0, 0, 0.25)",
                        }}
                      >
                        <SceneIcon className="w-5 h-5" style={{ color: theme.primary }} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium" style={{ color: theme.text }}>
                          {scene.label}
                        </div>
                        <div className="text-xs" style={{ color: theme.textMuted }}>
                          {scene.oneshots.length} one-shots
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(scene)}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: theme.accent }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = theme.bgSoft;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete scene "${scene.label}"?`)) {
                            onDeleteScene(scene.id);
                          }
                        }}
                        className="p-2 rounded-lg transition-colors"
                        style={{ color: theme.textMuted }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = theme.bgSoft;
                          e.currentTarget.style.color = "#E67E80";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.color = theme.textMuted;
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* Create/Edit Form */}
              <div className="space-y-4">
                {/* Scene Name */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
                    Scene Name
                  </label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    className="w-full p-2 rounded-lg"
                    style={{
                      background: theme.card,
                      border: `1px solid rgba(255, 255, 255, 0.1)`,
                      color: theme.text,
                    }}
                  />
                </div>

                {/* Icon Selector */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
                    Icon
                  </label>
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                    {availableIcons.map((iconName) => {
                      const IconComponent = iconMap[iconName];
                      const isSelected = formData.icon === iconName;
                      return (
                        <button
                          key={iconName}
                          onClick={() => setFormData({ ...formData, icon: iconName })}
                          className="p-3 rounded-lg transition-all"
                          style={{
                            background: isSelected ? theme.primary : theme.card,
                            border: isSelected
                              ? `2px solid ${theme.primary}`
                              : "1px solid rgba(0, 0, 0, 0.25)",
                            color: isSelected ? theme.bg : theme.text,
                          }}
                        >
                          <IconComponent className="w-5 h-5" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Current Layers */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
                    Layers (from current state)
                  </label>
                  <div className="space-y-2">
                    {currentLayers.environment && (
                      <div className="text-sm p-2 rounded" style={{ background: theme.card, color: theme.textMuted }}>
                        🌲 Environment: {currentLayers.environment.name}
                      </div>
                    )}
                    {currentLayers.weather && (
                      <div className="text-sm p-2 rounded" style={{ background: theme.card, color: theme.textMuted }}>
                        🌧️ Weather: {currentLayers.weather.name}
                      </div>
                    )}
                    {currentLayers.music && (
                      <div className="text-sm p-2 rounded" style={{ background: theme.card, color: theme.textMuted }}>
                        🎵 Music: {currentLayers.music.name}
                      </div>
                    )}
                  </div>
                </div>

                {/* One-Shots Selector */}
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: theme.text }}>
                    One-Shots ({formData.selectedOneShots.length} selected)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 rounded-lg" style={{ background: theme.bgSoft }}>
                    {oneShotLibrary.map((oneShot) => {
                      const isSelected = formData.selectedOneShots.includes(oneShot.id);
                      const OneShotIcon = iconMap[oneShot.icon];
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
                          <OneShotIcon className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">{oneShot.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={saveScene}
                    className="flex-1 flex items-center justify-center gap-2 p-3 rounded-xl transition-all font-semibold"
                    style={{
                      background: theme.primary,
                      color: theme.bg,
                    }}
                  >
                    <Save className="w-5 h-5" />
                    {editMode === "create" ? "Create Scene" : "Save Changes"}
                  </button>
                  <button
                    onClick={cancelEdit}
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
