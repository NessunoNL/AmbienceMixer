import { useState, useEffect, useRef } from "react";
import { Music, CloudRain, Trees, Settings2 } from "lucide-react";
import { Section } from "./components/Section";
import { SceneChip } from "./components/SceneChip";
import { VerticalFader } from "./components/VerticalFader";
import { LayerTile } from "./components/LayerTile";
import { OneShotButton } from "./components/OneShotButton";
import { LayerPicker } from "./components/LayerPicker";
import { SceneManager } from "./components/SceneManager";
import { AudioEngine } from "./audioEngine";
import { mockScenes, iconMap, environmentLibrary, weatherLibrary, musicLibrary } from "./mockData";
import { theme } from "./theme";
import type { LayerType, AudioLayer, Scene } from "./types";

function App() {
  // Scene management - load from localStorage or use defaults
  const [scenes, setScenes] = useState<Scene[]>(() => {
    const saved = localStorage.getItem("ambience-mixer-scenes");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved scenes:", e);
        return mockScenes;
      }
    }
    return mockScenes;
  });

  const [sceneId, setSceneId] = useState(() => {
    const savedSceneId = localStorage.getItem("ambience-mixer-current-scene");
    return savedSceneId || mockScenes[0].id;
  });

  const [sceneManagerOpen, setSceneManagerOpen] = useState(false);

  const [volumes, setVolumes] = useState({
    environment: 70,
    weather: 45,
    music: 60,
  });
  const [muted, setMuted] = useState({
    environment: false,
    weather: false,
    music: false,
  });
  const [oneShotVolume, setOneShotVolume] = useState(80);
  const [pickerOpen, setPickerOpen] = useState<LayerType | null>(null);

  // Track current layer selections (independent of scenes) - load from localStorage
  const [currentLayers, setCurrentLayers] = useState<{
    environment?: AudioLayer;
    weather?: AudioLayer;
    music?: AudioLayer;
  }>(() => {
    const saved = localStorage.getItem("ambience-mixer-current-layers");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved layers:", e);
      }
    }
    return {
      environment: mockScenes[0].environment,
      weather: mockScenes[0].weather,
      music: mockScenes[0].music,
    };
  });

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const currentScene = scenes.find((s) => s.id === sceneId)!;

  // Scene management handlers
  const handleSaveScene = (scene: Scene) => {
    const existingIndex = scenes.findIndex((s) => s.id === scene.id);
    if (existingIndex >= 0) {
      // Update existing scene
      const updatedScenes = [...scenes];
      updatedScenes[existingIndex] = scene;
      setScenes(updatedScenes);
    } else {
      // Add new scene
      setScenes([...scenes, scene]);
    }
  };

  const handleDeleteScene = (deletingSceneId: string) => {
    setScenes(scenes.filter((s) => s.id !== deletingSceneId));
    // If deleting current scene, switch to first available scene
    if (deletingSceneId === sceneId && scenes.length > 1) {
      const remainingScenes = scenes.filter((s) => s.id !== deletingSceneId);
      handleSceneChange(remainingScenes[0].id);
    }
  };

  // Initialize audio engine
  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
  }, []);

  // Persist scenes to localStorage
  useEffect(() => {
    localStorage.setItem("ambience-mixer-scenes", JSON.stringify(scenes));
  }, [scenes]);

  // Persist current scene to localStorage
  useEffect(() => {
    localStorage.setItem("ambience-mixer-current-scene", sceneId);
  }, [sceneId]);

  // Persist current layers to localStorage
  useEffect(() => {
    localStorage.setItem("ambience-mixer-current-layers", JSON.stringify(currentLayers));
  }, [currentLayers]);

  // Initialize audio on first user interaction
  const initializeAudio = () => {
    if (!audioInitialized && audioEngineRef.current) {
      audioEngineRef.current.resume();
      setAudioInitialized(true);
      loadScene(currentScene);
    }
  };

  // Load scene audio
  const loadScene = async (scene: typeof currentScene) => {
    if (!audioEngineRef.current || !audioInitialized) return;

    try {
      if (scene.environment) {
        await audioEngineRef.current.loadLayer(
          "environment",
          scene.environment.url,
          muted.environment ? 0 : volumes.environment / 100
        );
      }

      if (scene.weather) {
        await audioEngineRef.current.loadLayer(
          "weather",
          scene.weather.url,
          muted.weather ? 0 : volumes.weather / 100
        );
      }

      if (scene.music) {
        await audioEngineRef.current.loadLayer(
          "music",
          scene.music.url,
          muted.music ? 0 : volumes.music / 100
        );
      }
    } catch (error) {
      console.error("Failed to load scene:", error);
    }
  };

  // Handle scene change
  const handleSceneChange = (newSceneId: string) => {
    setSceneId(newSceneId);
    const newScene = scenes.find((s) => s.id === newSceneId)!;

    // Update current layers to match scene
    setCurrentLayers({
      environment: newScene.environment,
      weather: newScene.weather,
      music: newScene.music,
    });

    if (audioInitialized) {
      loadScene(newScene);
    }
  };

  // Handle layer selection from picker
  const handleLayerSelect = async (layer: LayerType, item: AudioLayer) => {
    // Update current layers state
    setCurrentLayers((prev) => ({ ...prev, [layer]: item }));

    // Load the new audio with crossfade
    if (audioEngineRef.current && audioInitialized) {
      try {
        await audioEngineRef.current.loadLayer(
          layer,
          item.url,
          muted[layer] ? 0 : volumes[layer] / 100
        );
      } catch (error) {
        console.error(`Failed to load ${layer}:`, error);
      }
    }
  };

  // Handle volume change
  const handleVolumeChange = (layer: LayerType, value: number) => {
    setVolumes((prev) => ({ ...prev, [layer]: value }));
    if (audioEngineRef.current && audioInitialized && !muted[layer]) {
      audioEngineRef.current.setVolume(layer, value / 100);
    }
  };

  // Handle mute toggle
  const handleMuteToggle = (layer: LayerType) => {
    const newMutedState = !muted[layer];
    setMuted((prev) => ({ ...prev, [layer]: newMutedState }));

    if (audioEngineRef.current && audioInitialized) {
      if (newMutedState) {
        // Fade to 0 when muting
        audioEngineRef.current.setVolume(layer, 0, 0.3);
      } else {
        // Fade back to current volume when unmuting
        audioEngineRef.current.setVolume(layer, volumes[layer] / 100, 0.3);
      }
    }
  };

  // Handle one-shot trigger
  const handleOneShotTrigger = async (url: string) => {
    const volume = oneShotVolume / 100;

    if (!audioInitialized) {
      initializeAudio();
      // Wait a bit for audio context to be ready
      setTimeout(() => {
        audioEngineRef.current?.playOneShot(url, volume);
      }, 100);
    } else {
      await audioEngineRef.current?.playOneShot(url, volume);
    }
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{
        background: `linear-gradient(180deg, ${theme.bg} 0%, #222827 100%)`,
        color: theme.text,
      }}
      onClick={initializeAudio}
    >
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-3xl font-bold" style={{ color: theme.primary }}>
            AmbientMixer
          </h1>
          {!audioInitialized && (
            <p className="text-sm mt-2" style={{ color: theme.textMuted }}>
              Click anywhere to start audio
            </p>
          )}
        </div>

        {/* Scenes Section */}
        <Section className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold" style={{ color: theme.text }}>
              Scenes
            </div>
            <button
              onClick={() => setSceneManagerOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
              style={{
                background: theme.card,
                color: theme.accent,
                border: `1px solid rgba(0, 0, 0, 0.25)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = theme.bgSoft;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = theme.card;
              }}
            >
              <Settings2 className="w-3 h-3" />
              Manage
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            {scenes.map((scene) => {
              const SceneIcon = iconMap[scene.icon];
              return (
                <SceneChip
                  key={scene.id}
                  icon={SceneIcon}
                  label={scene.label}
                  active={scene.id === sceneId}
                  onClick={() => handleSceneChange(scene.id)}
                />
              );
            })}
          </div>
        </Section>

        {/* Vertical Faders */}
        <section className="grid grid-cols-3 gap-4">
          <VerticalFader
            label="Environment"
            icon={Trees}
            value={volumes.environment}
            onChange={(value) => handleVolumeChange("environment", value)}
            muted={muted.environment}
            onMute={() => handleMuteToggle("environment")}
          />
          <VerticalFader
            label="Weather"
            icon={CloudRain}
            value={volumes.weather}
            onChange={(value) => handleVolumeChange("weather", value)}
            muted={muted.weather}
            onMute={() => handleMuteToggle("weather")}
          />
          <VerticalFader
            label="Music"
            icon={Music}
            value={volumes.music}
            onChange={(value) => handleVolumeChange("music", value)}
            muted={muted.music}
            onMute={() => handleMuteToggle("music")}
          />
        </section>

        {/* Layer Tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LayerTile
            label="Environment"
            icon={Trees}
            selected={currentLayers.environment}
            onPick={() => setPickerOpen("environment")}
          />
          <LayerTile
            label="Weather"
            icon={CloudRain}
            selected={currentLayers.weather}
            onPick={() => setPickerOpen("weather")}
          />
          <LayerTile
            label="Music"
            icon={Music}
            selected={currentLayers.music}
            onPick={() => setPickerOpen("music")}
          />
        </section>

        {/* Layer Pickers */}
        <LayerPicker
          isOpen={pickerOpen === "environment"}
          onClose={() => setPickerOpen(null)}
          layerType="environment"
          items={environmentLibrary}
          currentSelection={currentLayers.environment}
          onSelect={(item) => handleLayerSelect("environment", item)}
        />
        <LayerPicker
          isOpen={pickerOpen === "weather"}
          onClose={() => setPickerOpen(null)}
          layerType="weather"
          items={weatherLibrary}
          currentSelection={currentLayers.weather}
          onSelect={(item) => handleLayerSelect("weather", item)}
        />
        <LayerPicker
          isOpen={pickerOpen === "music"}
          onClose={() => setPickerOpen(null)}
          layerType="music"
          items={musicLibrary}
          currentSelection={currentLayers.music}
          onSelect={(item) => handleLayerSelect("music", item)}
        />

        {/* Scene Manager */}
        <SceneManager
          isOpen={sceneManagerOpen}
          onClose={() => setSceneManagerOpen(false)}
          scenes={scenes}
          currentLayers={currentLayers}
          onSaveScene={handleSaveScene}
          onDeleteScene={handleDeleteScene}
        />

        {/* One-Shots */}
        <Section className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">One‑Shots</div>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: theme.textMuted }}>
                Volume
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={oneShotVolume}
                onChange={(e) => setOneShotVolume(Number(e.target.value))}
                className="w-24 h-1 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${theme.primary} 0%, ${theme.primary} ${oneShotVolume}%, rgba(255,255,255,0.12) ${oneShotVolume}%, rgba(255,255,255,0.12) 100%)`,
                }}
              />
              <span className="text-xs w-8" style={{ color: theme.textMuted }}>
                {oneShotVolume}%
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {currentScene.oneshots.map((oneshot) => {
              const OneShotIcon = iconMap[oneshot.icon];
              return (
                <OneShotButton
                  key={oneshot.id}
                  name={oneshot.name}
                  icon={OneShotIcon}
                  onTrigger={() => handleOneShotTrigger(oneshot.url)}
                />
              );
            })}
          </div>
        </Section>
      </main>
    </div>
  );
}

export default App;
