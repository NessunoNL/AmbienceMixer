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
import { mockScenes, iconMap } from "./mockData";
import { api } from "./services/api";
import { theme } from "./theme";
import type { LayerType, AudioLayer, Scene } from "./types";
import type { AudioFile } from "./services/api";

function App() {
  // Audio library from backend
  const [audioLibrary, setAudioLibrary] = useState<{
    environment: AudioLayer[];
    weather: AudioLayer[];
    music: AudioLayer[];
    oneshots: AudioLayer[];
  }>({
    environment: [],
    weather: [],
    music: [],
    oneshots: [],
  });

  // Scene management - will load from backend
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [sceneId, setSceneId] = useState<string>("");
  const [sceneManagerOpen, setSceneManagerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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
    environment?: AudioLayer | null;
    weather?: AudioLayer | null;
    music?: AudioLayer | null;
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

  // Default crossfade durations per layer type (in seconds)
  const defaultCrossfadeDurations = {
    environment: 1.5,
    weather: 4.0,
    music: 3.0,
  };

  // Track queued layer selections (prepared but not yet activated)
  const [queuedLayers, setQueuedLayers] = useState<{
    environment?: { layer: AudioLayer | null; duration: number };
    weather?: { layer: AudioLayer | null; duration: number };
    music?: { layer: AudioLayer | null; duration: number };
  }>({});

  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [audioInitialized, setAudioInitialized] = useState(false);

  const currentScene = scenes.find((s) => s.id === sceneId);

  // Helper function to convert backend AudioFile to frontend AudioLayer
  const convertAudioFile = (file: AudioFile): AudioLayer => ({
    id: file.id.toString(),
    name: file.name,
    url: api.getAudioStreamUrl(file.id),
    volume: file.volume,
  });

  // Scene management handlers - now using backend API
  const handleSaveScene = async (scene: Scene) => {
    try {
      const existingIndex = scenes.findIndex((s) => s.id === scene.id);

      // Prepare scene data for backend (convert to audio file IDs)
      const sceneData = {
        id: scene.id,
        label: scene.label,
        icon: scene.icon,
        environment_id: scene.environment ? parseInt(scene.environment.id) : null,
        weather_id: scene.weather ? parseInt(scene.weather.id) : null,
        music_id: scene.music ? parseInt(scene.music.id) : null,
        oneshots: scene.oneshots.map(os => os.id),
      };

      if (existingIndex >= 0) {
        // Update existing scene
        await api.updateScene(scene.id, sceneData);
        const updatedScenes = [...scenes];
        updatedScenes[existingIndex] = scene;
        setScenes(updatedScenes);
      } else {
        // Add new scene
        await api.createScene(sceneData);
        setScenes([...scenes, scene]);
      }
    } catch (error) {
      console.error("Failed to save scene:", error);
      alert("Failed to save scene. Please try again.");
    }
  };

  const handleDeleteScene = async (deletingSceneId: string) => {
    try {
      await api.deleteScene(deletingSceneId);
      setScenes(scenes.filter((s) => s.id !== deletingSceneId));

      // If deleting current scene, switch to first available scene
      if (deletingSceneId === sceneId && scenes.length > 1) {
        const remainingScenes = scenes.filter((s) => s.id !== deletingSceneId);
        handleSceneChange(remainingScenes[0].id);
      }
    } catch (error) {
      console.error("Failed to delete scene:", error);
      alert("Failed to delete scene. Please try again.");
    }
  };

  // Initialize audio engine
  useEffect(() => {
    audioEngineRef.current = new AudioEngine();
  }, []);

  // Load audio library and scenes from backend on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load audio library
        const library = await api.getAudioLibrary();
        const convertedLibrary = {
          environment: library.environment.map(convertAudioFile),
          weather: library.weather.map(convertAudioFile),
          music: library.music.map(convertAudioFile),
          oneshots: library.oneshots.map(convertAudioFile),
        };
        setAudioLibrary(convertedLibrary);

        // Load scenes from backend
        const backendScenes = await api.getScenes();
        if (backendScenes.length > 0) {
          setScenes(backendScenes);
          setSceneId(backendScenes[0].id);
        } else {
          // No scenes in backend, use mock scenes as fallback
          setScenes(mockScenes);
          setSceneId(mockScenes[0].id);
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to load from backend, using mock data:", error);
        // Fallback to mock data
        setScenes(mockScenes);
        setSceneId(mockScenes[0].id);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Persist current scene to localStorage (as cache)
  useEffect(() => {
    if (sceneId) {
      localStorage.setItem("ambience-mixer-current-scene", sceneId);
    }
  }, [sceneId]);

  // Persist current layers to localStorage (as cache)
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
  const loadScene = async (scene: Scene | undefined) => {
    if (!audioEngineRef.current || !audioInitialized || !scene) return;

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
    const newScene = scenes.find((s) => s.id === newSceneId);
    if (!newScene) return;

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

  // Handle layer selection from picker - add to queue instead of loading immediately
  const handleLayerSelect = (layer: LayerType, item: AudioLayer | null) => {
    setQueuedLayers((prev) => ({
      ...prev,
      [layer]: { layer: item, duration: defaultCrossfadeDurations[layer] }
    }));
  };

  // Handle crossfade duration change for a queued layer
  const handleDurationChange = (layer: LayerType, duration: number) => {
    setQueuedLayers((prev) => {
      const existing = prev[layer];
      if (!existing) return prev;
      return { ...prev, [layer]: { ...existing, duration } };
    });
  };

  // Handle queue switch - load all queued layers with crossfade
  const handleQueueSwitch = async () => {
    if (!audioEngineRef.current || !audioInitialized) return;

    // Load all queued layers in parallel with crossfade
    const loadPromises = Object.entries(queuedLayers).map(([layerType, queuedItem]) => {
      const type = layerType as LayerType;

      // If layer is null, stop the layer (silence) with user-selected duration
      if (queuedItem.layer === null) {
        audioEngineRef.current!.stopLayer(type, true, queuedItem.duration);
        return Promise.resolve();
      }

      return audioEngineRef.current!.loadLayer(
        type,
        queuedItem.layer.url,
        muted[type] ? 0 : volumes[type] / 100,
        queuedItem.duration
      );
    });

    try {
      await Promise.all(loadPromises);

      // Update current layers with queued layers (extract just the layer, not duration)
      const newLayers = Object.entries(queuedLayers).reduce((acc, [key, value]) => {
        acc[key as LayerType] = value.layer;
        return acc;
      }, {} as typeof currentLayers);
      setCurrentLayers((prev) => ({ ...prev, ...newLayers }));

      // Clear the queue
      setQueuedLayers({});
    } catch (error) {
      console.error("Failed to switch layers:", error);
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
          {loading ? (
            <p className="text-sm mt-2" style={{ color: theme.textMuted }}>
              Loading audio library...
            </p>
          ) : !audioInitialized ? (
            <p className="text-sm mt-2" style={{ color: theme.textMuted }}>
              Click anywhere to start audio
            </p>
          ) : null}
        </div>

        {loading ? (
          <div className="text-center py-20" style={{ color: theme.textMuted }}>
            Loading...
          </div>
        ) : (
          <>

        {/* Scenes Section */}
        <Section className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold" style={{ color: theme.text }}>
              Scenes
            </div>
            <div className="flex items-center gap-2">
              {Object.keys(queuedLayers).length > 0 && (
                <button
                  onClick={handleQueueSwitch}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: theme.accent,
                    color: theme.bg,
                    border: `1px solid rgba(0, 0, 0, 0.25)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "0.9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                >
                  Switch ({Object.keys(queuedLayers).length})
                </button>
              )}
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
            queued={queuedLayers.environment}
            defaultDuration={defaultCrossfadeDurations.environment}
            onPick={() => setPickerOpen("environment")}
            onDurationChange={(duration) => handleDurationChange("environment", duration)}
          />
          <LayerTile
            label="Weather"
            icon={CloudRain}
            selected={currentLayers.weather}
            queued={queuedLayers.weather}
            defaultDuration={defaultCrossfadeDurations.weather}
            onPick={() => setPickerOpen("weather")}
            onDurationChange={(duration) => handleDurationChange("weather", duration)}
          />
          <LayerTile
            label="Music"
            icon={Music}
            selected={currentLayers.music}
            queued={queuedLayers.music}
            defaultDuration={defaultCrossfadeDurations.music}
            onPick={() => setPickerOpen("music")}
            onDurationChange={(duration) => handleDurationChange("music", duration)}
          />
        </section>

        {/* Layer Pickers */}
        <LayerPicker
          isOpen={pickerOpen === "environment"}
          onClose={() => setPickerOpen(null)}
          layerType="environment"
          items={audioLibrary.environment}
          currentSelection={currentLayers.environment}
          onSelect={(item) => handleLayerSelect("environment", item)}
        />
        <LayerPicker
          isOpen={pickerOpen === "weather"}
          onClose={() => setPickerOpen(null)}
          layerType="weather"
          items={audioLibrary.weather}
          currentSelection={currentLayers.weather}
          onSelect={(item) => handleLayerSelect("weather", item)}
        />
        <LayerPicker
          isOpen={pickerOpen === "music"}
          onClose={() => setPickerOpen(null)}
          layerType="music"
          items={audioLibrary.music}
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
            {currentScene?.oneshots.map((oneshot) => {
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
        </>
        )}
      </main>
    </div>
  );
}

export default App;
