import { useState, useEffect, useRef } from "react";
import { Music, CloudRain, Trees, Settings2, VolumeX, Volume2, RefreshCw, Tag } from "lucide-react";
import { Section } from "./components/Section";
import { SceneChip } from "./components/SceneChip";
import { VerticalFader } from "./components/VerticalFader";
import { LayerTile } from "./components/LayerTile";
import { OneShotButton } from "./components/OneShotButton";
import { LayerPicker } from "./components/LayerPicker";
import { SceneManager } from "./components/SceneManager";
import { OneShotPicker } from "./components/OneShotPicker";
import { MusicTagManager } from "./components/MusicTagManager";
import { MusicModeSelector } from "./components/MusicModeSelector";
import { AudioEngine } from "./audioEngine";
import { iconMap } from "./iconMap";
import { api } from "./services/api";
import { theme } from "./theme";
import type { LayerType, AudioLayer, Scene, OneShot, MusicTag, MusicPlaybackMode } from "./types";
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
  const [preMuteVolumes, setPreMuteVolumes] = useState({
    environment: 70,
    weather: 45,
    music: 60,
  });
  const [mainMuted, setMainMuted] = useState(false);
  const [oneShotVolume, setOneShotVolume] = useState(80);
  const [pickerOpen, setPickerOpen] = useState<LayerType | null>(null);
  const [oneShotPickerOpen, setOneShotPickerOpen] = useState(false);

  // Track temporary one-shot overrides (not saved to scene)
  const [temporaryOneShots, setTemporaryOneShots] = useState<OneShot[] | null>(null);

  // Music tags and playback mode
  const [musicTags, setMusicTags] = useState<MusicTag[]>([]);
  const [musicMode, setMusicMode] = useState<MusicPlaybackMode>("single-loop");
  const [selectedMusicTag, setSelectedMusicTag] = useState<MusicTag | null>(null);
  const [currentTrackInfo, setCurrentTrackInfo] = useState<{ name: string; index: number; total: number } | null>(null);
  const [tagManagerOpen, setTagManagerOpen] = useState(false);

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
      environment: null,
      weather: null,
      music: null,
    };
  });

  // Default crossfade durations per layer type (in seconds)
  const defaultCrossfadeDurations = {
    environment: 6.0,
    weather: 6.0,
    music: 6.0,
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
    duration: file.duration,
    format: file.format,
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
        environment_id: scene.environment?.id ? parseInt(scene.environment.id) : null,
        weather_id: scene.weather?.id ? parseInt(scene.weather.id) : null,
        music_id: scene.music?.id ? parseInt(scene.music.id) : null,
        oneshots: scene.oneshots.map(os => parseInt(os.id)),
        environmentVolume: scene.environmentVolume,
        weatherVolume: scene.weatherVolume,
        musicVolume: scene.musicVolume,
      };

      console.log('[App] Saving scene to backend:', { id: scene.id, label: scene.label, volumes: { env: scene.environmentVolume, weather: scene.weatherVolume, music: scene.musicVolume } });

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

        // Load music tags
        const tags = await api.getAllMusicTags();
        setMusicTags(tags);

        // Load scenes from backend
        const backendScenes = await api.getScenes();
        setScenes(backendScenes);
        if (backendScenes.length > 0) {
          setSceneId(backendScenes[0].id);
        }

        setLoading(false);
      } catch (error) {
        console.error("Failed to load from backend:", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Reload audio library when tags are updated
  const handleTagsUpdated = async () => {
    try {
      const library = await api.getAudioLibrary();
      const convertedLibrary = {
        environment: library.environment.map(convertAudioFile),
        weather: library.weather.map(convertAudioFile),
        music: library.music.map(convertAudioFile),
        oneshots: library.oneshots.map(convertAudioFile),
      };
      setAudioLibrary(convertedLibrary);

      const tags = await api.getAllMusicTags();
      setMusicTags(tags);
    } catch (error) {
      console.error("Failed to reload library:", error);
    }
  };

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

  // Animate volume changes over time (optimized with batched updates)
  const animateVolume = (
    layer: LayerType,
    fromValue: number,
    toValue: number,
    duration: number,
    isMuteOperation = false
  ) => {
    const startTime = performance.now();
    let lastStateUpdate = startTime;
    const STATE_UPDATE_INTERVAL = 50; // Update React state every 50ms for smooth visuals

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // Ease-in-out function for smooth animation
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const currentValue = Math.round(fromValue + (toValue - fromValue) * easeProgress);

      // Update React state every 50ms (not every frame) for smooth rendering without performance hit
      if (currentTime - lastStateUpdate >= STATE_UPDATE_INTERVAL || progress >= 1) {
        setVolumes((prev) => ({ ...prev, [layer]: currentValue }));
        lastStateUpdate = currentTime;
      }

      // Update audio engine (skip during mute/unmute as audio has its own separate fade)
      if (!isMuteOperation && audioEngineRef.current) {
        audioEngineRef.current.setVolume(layer, currentValue / 100, 0);
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        console.log(`[Volume Animation] ${layer} completed: ${fromValue} → ${toValue}`);
      }
    };

    console.log(`[Volume Animation] Starting ${layer}: ${fromValue} → ${toValue} over ${duration}s`);
    requestAnimationFrame(animate);
  };

  // Handle scene change
  const handleSceneChange = (newSceneId: string) => {
    setSceneId(newSceneId);
    const newScene = scenes.find((s) => s.id === newSceneId);
    if (!newScene) return;

    console.log('[Scene Change] Loading scene:', {
      id: newScene.id,
      label: newScene.label,
      savedVolumes: {
        env: newScene.environmentVolume,
        weather: newScene.weatherVolume,
        music: newScene.musicVolume
      },
      currentVolumes: volumes
    });

    // Update current layers to match scene
    setCurrentLayers({
      environment: newScene.environment,
      weather: newScene.weather,
      music: newScene.music,
    });

    // Animate volume changes if scene has saved volumes
    if (newScene.environmentVolume !== undefined) {
      animateVolume("environment", volumes.environment, newScene.environmentVolume, 6);
    }
    if (newScene.weatherVolume !== undefined) {
      animateVolume("weather", volumes.weather, newScene.weatherVolume, 6);
    }
    if (newScene.musicVolume !== undefined) {
      animateVolume("music", volumes.music, newScene.musicVolume, 6);
    }

    if (audioInitialized) {
      loadScene(newScene);
    }
  };

  // Handle music mode change
  const handleMusicModeChange = (mode: MusicPlaybackMode) => {
    setMusicMode(mode);

    // If switching to tag-shuffle mode and a tag is selected, load the playlist
    if (mode === "tag-shuffle" && selectedMusicTag) {
      loadMusicPlaylist(selectedMusicTag);
    }
  };

  // Handle music tag selection
  const handleMusicTagSelect = async (tag: MusicTag | null) => {
    setSelectedMusicTag(tag);

    // If in tag-shuffle mode and a tag is selected, load the playlist
    if (musicMode === "tag-shuffle" && tag) {
      await loadMusicPlaylist(tag);
    }
  };

  // Load music playlist by tag
  const loadMusicPlaylist = async (tag: MusicTag) => {
    if (!audioEngineRef.current || !audioInitialized) return;

    try {
      const files = await api.getAudioFilesByTag(tag.id);

      if (files.length === 0) {
        alert(`No music files found with tag "${tag.name}"`);
        return;
      }

      const urls = files.map(file => api.getAudioStreamUrl(file.id));
      await audioEngineRef.current.loadMusicPlaylist(
        urls,
        muted.music ? 0 : volumes.music / 100,
        true // shuffle
      );

      // Update track info
      updateCurrentTrackInfo();
    } catch (error) {
      console.error("Failed to load music playlist:", error);
      alert("Failed to load music playlist");
    }
  };

  // Update current track info (for display)
  const updateCurrentTrackInfo = () => {
    if (audioEngineRef.current) {
      const trackInfo = audioEngineRef.current.getCurrentTrackInfo();
      setCurrentTrackInfo(trackInfo);
    }
  };

  // Skip to next track in playlist
  const handleSkipTrack = async () => {
    if (audioEngineRef.current && musicMode === "tag-shuffle") {
      await audioEngineRef.current.playNextTrack();
      updateCurrentTrackInfo();
    }
  };

  // Handle layer selection from picker - add to queue instead of loading immediately
  const handleLayerSelect = (layer: LayerType, item: AudioLayer | null) => {
    // If selecting music in single-loop mode, clear playlist
    if (layer === "music" && musicMode === "single-loop") {
      setCurrentTrackInfo(null);
    }

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

  // Handle individual layer switch
  const handleIndividualLayerSwitch = async (layer: LayerType) => {
    if (!audioEngineRef.current || !audioInitialized) return;

    const queuedItem = queuedLayers[layer];
    if (!queuedItem) return;

    try {
      // If layer is null, stop the layer (silence) with user-selected duration
      if (queuedItem.layer === null) {
        await audioEngineRef.current.stopLayer(layer, true, queuedItem.duration);
      } else {
        await audioEngineRef.current.loadLayer(
          layer,
          queuedItem.layer.url,
          muted[layer] ? 0 : volumes[layer] / 100,
          queuedItem.duration
        );
      }

      // Update current layer
      setCurrentLayers((prev) => ({ ...prev, [layer]: queuedItem.layer }));

      // Remove this layer from queue
      setQueuedLayers((prev) => {
        const updated = { ...prev };
        delete updated[layer];
        return updated;
      });
    } catch (error) {
      console.error(`Failed to switch ${layer} layer:`, error);
    }
  };

  // Handle volume change
  const handleVolumeChange = (layer: LayerType, value: number) => {
    setVolumes((prev) => ({ ...prev, [layer]: value }));

    // If layer is muted and user moves slider above 0, unmute it
    const wasMuted = muted[layer];
    if (wasMuted && value > 0) {
      setMuted((prev) => ({ ...prev, [layer]: false }));
      // Also update preMuteVolumes to the new value so it doesn't revert
      setPreMuteVolumes((prev) => ({ ...prev, [layer]: value }));
    }

    // Update audio engine (unmute if it was muted and value > 0)
    if (audioEngineRef.current && audioInitialized) {
      if (!muted[layer] || (wasMuted && value > 0)) {
        audioEngineRef.current.setVolume(layer, value / 100);
      }
    }
  };

  // Handle mute toggle with 2-second animated transition
  const handleMuteToggle = (layer: LayerType) => {
    const newMutedState = !muted[layer];
    setMuted((prev) => ({ ...prev, [layer]: newMutedState }));

    if (audioEngineRef.current && audioInitialized) {
      if (newMutedState) {
        // Save current volume before muting
        setPreMuteVolumes((prev) => ({ ...prev, [layer]: volumes[layer] }));

        // Animate slider to 0 and fade audio over 2 seconds
        animateVolume(layer, volumes[layer], 0, 2, true);
        audioEngineRef.current.setVolume(layer, 0, 2);
      } else {
        // Animate slider back to pre-mute volume over 2 seconds
        const targetVolume = preMuteVolumes[layer];
        animateVolume(layer, 0, targetVolume, 2, true);
        audioEngineRef.current.setVolume(layer, targetVolume / 100, 2);
      }
    }
  };

  // Handle main mute toggle (all layers) with 2-second animation
  const handleMainMuteToggle = () => {
    const newMainMutedState = !mainMuted;
    setMainMuted(newMainMutedState);

    if (audioEngineRef.current && audioInitialized) {
      const layers: LayerType[] = ["environment", "weather", "music"];

      if (newMainMutedState) {
        // Save current volumes and animate all sliders to 0 over 2 seconds
        layers.forEach((layer) => {
          if (!muted[layer]) {
            setPreMuteVolumes((prev) => ({ ...prev, [layer]: volumes[layer] }));
            animateVolume(layer, volumes[layer], 0, 2, true);
            audioEngineRef.current!.setVolume(layer, 0, 2);
          }
        });
      } else {
        // Animate all sliders back to saved volumes over 2 seconds (respect individual mute states)
        layers.forEach((layer) => {
          if (!muted[layer]) {
            const targetVolume = preMuteVolumes[layer];
            animateVolume(layer, 0, targetVolume, 2, true);
            audioEngineRef.current!.setVolume(layer, targetVolume / 100, 2);
          }
        });
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

  // Handle audio library rescan
  const handleRescan = async () => {
    try {
      setLoading(true);
      const result = await api.triggerAudioScan();
      console.log(`Rescan complete: ${result.totalFiles} files indexed in ${result.duration}ms`);

      // Reload library after scan
      const library = await api.getAudioLibrary();
      const convertedLibrary = {
        environment: library.environment.map(convertAudioFile),
        weather: library.weather.map(convertAudioFile),
        music: library.music.map(convertAudioFile),
        oneshots: library.oneshots.map(convertAudioFile),
      };
      setAudioLibrary(convertedLibrary);
      setLoading(false);

      alert(`Audio library rescanned: ${result.totalFiles} files found`);
    } catch (error) {
      console.error("Failed to rescan audio library:", error);
      setLoading(false);
      alert("Failed to rescan audio library. Check console for details.");
    }
  };

  // Handle temporary one-shot customization
  const handleTemporaryOneShotsApply = (oneShots: OneShot[]) => {
    setTemporaryOneShots(oneShots);
  };

  // Clear temporary one-shots
  const handleClearTemporaryOneShots = () => {
    setTemporaryOneShots(null);
  };

  // Get the actual one-shots to display (temporary overrides scene)
  const displayedOneShots = temporaryOneShots || currentScene?.oneshots || [];

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
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-3xl font-bold" style={{ color: theme.primary }}>
              AmbientMixer
            </h1>
            {audioInitialized && (
              <button
                onClick={handleMainMuteToggle}
                className="p-2 rounded-lg transition-colors"
                style={{
                  background: mainMuted ? theme.card : theme.bgSoft,
                  color: mainMuted ? theme.textMuted : theme.primary,
                  border: `1px solid ${mainMuted ? 'rgba(0, 0, 0, 0.25)' : theme.primary}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.8";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
                title={mainMuted ? "Unmute all" : "Mute all"}
              >
                {mainMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
            )}
            <button
              onClick={handleRescan}
              disabled={loading}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: theme.bgSoft,
                color: theme.accent,
                border: `1px solid rgba(0, 0, 0, 0.25)`,
                opacity: loading ? 0.5 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.opacity = "1";
              }}
              title="Rescan audio library"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setTagManagerOpen(true)}
              className="p-2 rounded-lg transition-colors"
              style={{
                background: theme.bgSoft,
                color: theme.primary,
                border: `1px solid rgba(0, 0, 0, 0.25)`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.8";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
              title="Manage music tags"
            >
              <Tag className="w-5 h-5" />
            </button>
          </div>
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
            {scenes.length === 0 ? (
              <div className="w-full text-center py-8" style={{ color: theme.textMuted }}>
                <p>No scenes created yet.</p>
                <p className="text-sm mt-2">Click "Manage" to create your first scene.</p>
              </div>
            ) : (
              scenes.map((scene) => {
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
              })
            )}
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
            onSwitchLayer={() => handleIndividualLayerSwitch("environment")}
          />
          <LayerTile
            label="Weather"
            icon={CloudRain}
            selected={currentLayers.weather}
            queued={queuedLayers.weather}
            defaultDuration={defaultCrossfadeDurations.weather}
            onPick={() => setPickerOpen("weather")}
            onDurationChange={(duration) => handleDurationChange("weather", duration)}
            onSwitchLayer={() => handleIndividualLayerSwitch("weather")}
          />
          <LayerTile
            label="Music"
            icon={Music}
            selected={currentLayers.music}
            queued={queuedLayers.music}
            defaultDuration={defaultCrossfadeDurations.music}
            onPick={() => setPickerOpen("music")}
            onDurationChange={(duration) => handleDurationChange("music", duration)}
            onSwitchLayer={() => handleIndividualLayerSwitch("music")}
          />
        </section>

        {/* Music Playback Mode */}
        <Section className="p-3">
          <div className="font-semibold mb-3" style={{ color: theme.text }}>
            Music Playback
          </div>
          <MusicModeSelector
            mode={musicMode}
            selectedTag={selectedMusicTag}
            availableTags={musicTags}
            currentTrack={currentTrackInfo}
            onModeChange={handleMusicModeChange}
            onTagSelect={handleMusicTagSelect}
            onSkipTrack={handleSkipTrack}
          />
        </Section>

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
          currentVolumes={volumes}
          oneShotLibrary={audioLibrary.oneshots}
          onSaveScene={handleSaveScene}
          onDeleteScene={handleDeleteScene}
        />

        {/* One-Shots */}
        <Section className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="font-semibold">One‑Shots</div>
              {temporaryOneShots && (
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: theme.accent, color: theme.bg }}>
                  Customized
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {temporaryOneShots && (
                <button
                  onClick={handleClearTemporaryOneShots}
                  className="text-xs px-2 py-1 rounded-lg transition-colors"
                  style={{
                    background: theme.card,
                    color: theme.textMuted,
                    border: `1px solid rgba(0, 0, 0, 0.25)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.bgSoft;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.card;
                  }}
                >
                  Reset
                </button>
              )}
              <button
                onClick={() => setOneShotPickerOpen(true)}
                className="text-xs px-2 py-1 rounded-lg transition-colors"
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
                Customize
              </button>
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
            {displayedOneShots.length === 0 ? (
              <div className="col-span-full text-center py-8" style={{ color: theme.textMuted }}>
                <p>No one-shots available for this scene.</p>
                <p className="text-sm mt-2">Click "Customize" to add some.</p>
              </div>
            ) : (
              displayedOneShots.map((oneshot) => {
                const OneShotIcon = iconMap[oneshot.icon];
                return (
                  <OneShotButton
                    key={oneshot.id}
                    name={oneshot.name}
                    icon={OneShotIcon}
                    onTrigger={() => handleOneShotTrigger(oneshot.url)}
                  />
                );
              })
            )}
          </div>
        </Section>

        {/* One-Shot Picker */}
        <OneShotPicker
          isOpen={oneShotPickerOpen}
          onClose={() => setOneShotPickerOpen(false)}
          availableOneShots={audioLibrary.oneshots}
          currentSelection={displayedOneShots}
          onApply={handleTemporaryOneShotsApply}
          temporary={true}
        />

        {/* Music Tag Manager */}
        <MusicTagManager
          isOpen={tagManagerOpen}
          onClose={() => setTagManagerOpen(false)}
          musicFiles={audioLibrary.music}
          onTagsUpdated={handleTagsUpdated}
        />
        </>
        )}
      </main>
    </div>
  );
}

export default App;
