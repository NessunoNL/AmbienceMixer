import type { LayerType } from "./types";

interface MusicPlaylist {
  urls: string[];
  currentIndex: number;
  shuffle: boolean;
  volume: number;
}

export class AudioEngine {
  private audioContext: AudioContext;
  private layers: Map<LayerType, AudioLayerInstance> = new Map();
  private fadingOutLayers: Set<AudioLayerInstance> = new Set();
  private masterGain: GainNode;
  private musicPlaylist: MusicPlaylist | null = null;

  constructor() {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  async loadLayer(type: LayerType, url: string, volume: number = 1, crossfadeDuration: number = 1.5): Promise<void> {
    // Clear playlist if loading music layer (single track mode)
    if (type === "music") {
      this.musicPlaylist = null;
    }

    // Get existing layer and move to fading out state
    const oldLayer = this.layers.get(type);
    const currentTime = this.audioContext.currentTime;
    const timeConstant = crossfadeDuration / 5;

    // Remove old layer from active map immediately (before starting new one)
    if (oldLayer) {
      this.layers.delete(type);
      this.fadingOutLayers.add(oldLayer);

      // Fade out old layer
      oldLayer.gainNode.gain.cancelScheduledValues(currentTime);
      oldLayer.gainNode.gain.setValueAtTime(oldLayer.gainNode.gain.value, currentTime);
      oldLayer.gainNode.gain.setTargetAtTime(0, currentTime, timeConstant);

      // Schedule cleanup after crossfade completes
      setTimeout(() => {
        // Stop audio source
        if (oldLayer.audioElement) {
          oldLayer.audioElement.pause();
          oldLayer.audioElement.currentTime = 0;
        } else {
          (oldLayer.source as AudioBufferSourceNode).stop();
        }

        // Disconnect audio nodes from graph
        oldLayer.gainNode.disconnect();
        oldLayer.source.disconnect();

        // Remove from fading out tracking
        this.fadingOutLayers.delete(oldLayer);
      }, crossfadeDuration * 1000 * 5); // Wait for exponential fade to complete (~5 time constants)
    }

    try {
      // Use streaming playback for looping layers (faster load times)
      const audio = new Audio(url);
      audio.loop = (type !== "music"); // Music doesn't loop in single track mode
      audio.preload = "auto";

      // Create media element source node for streaming
      const source = this.audioContext.createMediaElementSource(audio);

      const gainNode = this.audioContext.createGain();

      // Set gain to 0 and schedule the crossfade immediately
      gainNode.gain.setValueAtTime(0, currentTime);

      source.connect(gainNode);
      gainNode.connect(this.masterGain);

      // Start playing (will stream from server)
      await audio.play();

      const newLayer = new AudioLayerInstance(source, gainNode, audio);

      // Set new layer in map immediately so commands target the correct layer
      this.layers.set(type, newLayer);

      // Crossfade in with exponential curve (skip if muted)
      if (volume > 0) {
        // Get fresh current time after audio load (in case it took time)
        const fadeStartTime = this.audioContext.currentTime;
        // Use setTargetAtTime for smooth exponential fade
        // Time constant = duration / 5 gives ~99% completion at duration
        gainNode.gain.cancelScheduledValues(fadeStartTime);
        gainNode.gain.setValueAtTime(0, fadeStartTime);
        gainNode.gain.setTargetAtTime(volume, fadeStartTime, timeConstant);
      }
      // If volume is 0 (muted), keep it at 0 without crossfading
    } catch (error) {
      console.error(`Failed to load audio for ${type}:`, error);
      throw error;
    }
  }

  async crossfadeLayer(type: LayerType, targetVolume: number, duration: number = 1000): Promise<void> {
    const layer = this.layers.get(type);
    if (!layer) return;

    const currentTime = this.audioContext.currentTime;
    const timeConstant = (duration / 1000) / 5; // Convert ms to seconds, divide by 5 for exponential curve

    layer.gainNode.gain.cancelScheduledValues(currentTime);
    layer.gainNode.gain.setValueAtTime(layer.gainNode.gain.value, currentTime);
    layer.gainNode.gain.setTargetAtTime(targetVolume, currentTime, timeConstant);
  }

  setVolume(type: LayerType, volume: number, fadeDuration: number = 0.05): void {
    const layer = this.layers.get(type);
    if (!layer) return;

    const currentTime = this.audioContext.currentTime;
    const timeConstant = fadeDuration / 5; // Exponential curve

    layer.gainNode.gain.cancelScheduledValues(currentTime);
    layer.gainNode.gain.setValueAtTime(layer.gainNode.gain.value, currentTime);
    layer.gainNode.gain.setTargetAtTime(volume, currentTime, timeConstant);
  }

  async stopLayer(type: LayerType, fadeOut: boolean = true, fadeDuration: number = 0.5): Promise<void> {
    const layer = this.layers.get(type);
    if (!layer) return;

    // Remove from active layers map immediately
    this.layers.delete(type);

    if (fadeOut) {
      // Add to fading out tracking
      this.fadingOutLayers.add(layer);

      const durationMs = fadeDuration * 1000;
      const currentTime = this.audioContext.currentTime;
      const timeConstant = (fadeDuration) / 5;

      // Fade out
      layer.gainNode.gain.cancelScheduledValues(currentTime);
      layer.gainNode.gain.setValueAtTime(layer.gainNode.gain.value, currentTime);
      layer.gainNode.gain.setTargetAtTime(0, currentTime, timeConstant);

      setTimeout(() => {
        // Stop audio source
        if (layer.audioElement) {
          layer.audioElement.pause();
          layer.audioElement.currentTime = 0;
        } else {
          (layer.source as AudioBufferSourceNode).stop();
        }

        // Disconnect audio nodes from graph
        layer.gainNode.disconnect();
        layer.source.disconnect();

        // Remove from fading out tracking
        this.fadingOutLayers.delete(layer);
      }, durationMs * 5); // Wait for exponential fade to complete (~5 time constants)
    } else {
      // Stop immediately without fade
      if (layer.audioElement) {
        layer.audioElement.pause();
        layer.audioElement.currentTime = 0;
      } else {
        (layer.source as AudioBufferSourceNode).stop();
      }

      // Disconnect audio nodes from graph
      layer.gainNode.disconnect();
      layer.source.disconnect();
    }
  }

  async playOneShot(url: string, volume: number = 0.8): Promise<void> {
    try {
      // Play one-shot
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = this.audioContext.createGain();
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.masterGain);

      source.start(0);
    } catch (error) {
      console.error("Failed to play one-shot:", error);
    }
  }

  async loadMusicPlaylist(urls: string[], volume: number = 1, shuffle: boolean = true): Promise<void> {
    if (urls.length === 0) {
      throw new Error("Cannot load empty playlist");
    }

    // Initialize playlist
    const playOrder = shuffle ? this.shuffleArray([...urls]) : urls;
    this.musicPlaylist = {
      urls: playOrder,
      currentIndex: 0,
      shuffle,
      volume,
    };

    // Load first track
    await this.loadPlaylistTrack(0, volume);
  }

  private async loadPlaylistTrack(index: number, volume: number, crossfadeDuration: number = 1.5): Promise<void> {
    if (!this.musicPlaylist || index >= this.musicPlaylist.urls.length) {
      return;
    }

    const url = this.musicPlaylist.urls[index];
    this.musicPlaylist.currentIndex = index;

    // Get existing music layer
    const oldLayer = this.layers.get("music");
    const currentTime = this.audioContext.currentTime;
    const timeConstant = crossfadeDuration / 5;

    // Fade out old layer if exists
    if (oldLayer) {
      this.layers.delete("music");
      this.fadingOutLayers.add(oldLayer);

      oldLayer.gainNode.gain.cancelScheduledValues(currentTime);
      oldLayer.gainNode.gain.setValueAtTime(oldLayer.gainNode.gain.value, currentTime);
      oldLayer.gainNode.gain.setTargetAtTime(0, currentTime, timeConstant);

      setTimeout(() => {
        if (oldLayer.audioElement) {
          oldLayer.audioElement.pause();
          oldLayer.audioElement.currentTime = 0;
          oldLayer.audioElement.removeEventListener("ended", oldLayer.onEnded!);
        }
        oldLayer.gainNode.disconnect();
        oldLayer.source.disconnect();
        this.fadingOutLayers.delete(oldLayer);
      }, crossfadeDuration * 1000 * 5);
    }

    try {
      const audio = new Audio(url);
      audio.loop = false; // Playlist mode - don't loop individual tracks
      audio.preload = "auto";

      // Set up track-end handler to play next track
      const onEnded = () => {
        console.log("[Playlist] Track ended, playing next");
        this.playNextTrack();
      };
      audio.addEventListener("ended", onEnded);

      const source = this.audioContext.createMediaElementSource(audio);
      const gainNode = this.audioContext.createGain();

      gainNode.gain.setValueAtTime(0, currentTime);

      source.connect(gainNode);
      gainNode.connect(this.masterGain);

      await audio.play();

      const newLayer = new AudioLayerInstance(source, gainNode, audio, onEnded);
      this.layers.set("music", newLayer);

      // Fade in
      if (volume > 0) {
        const fadeStartTime = this.audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(fadeStartTime);
        gainNode.gain.setValueAtTime(0, fadeStartTime);
        gainNode.gain.setTargetAtTime(volume, fadeStartTime, timeConstant);
      }
    } catch (error) {
      console.error("Failed to load playlist track:", error);
      // Try next track on error
      this.playNextTrack();
    }
  }

  async playNextTrack(): Promise<void> {
    if (!this.musicPlaylist) return;

    const nextIndex = (this.musicPlaylist.currentIndex + 1) % this.musicPlaylist.urls.length;

    // If we've completed the playlist and shuffle is on, reshuffle
    if (nextIndex === 0 && this.musicPlaylist.shuffle) {
      this.musicPlaylist.urls = this.shuffleArray([...this.musicPlaylist.urls]);
    }

    await this.loadPlaylistTrack(nextIndex, this.musicPlaylist.volume, 2.0);
  }

  getCurrentTrackInfo(): { name: string; index: number; total: number } | null {
    if (!this.musicPlaylist) return null;

    const url = this.musicPlaylist.urls[this.musicPlaylist.currentIndex];
    const name = url.split('/').pop()?.replace(/\.[^/.]+$/, '') || "Unknown Track";

    return {
      name,
      index: this.musicPlaylist.currentIndex,
      total: this.musicPlaylist.urls.length,
    };
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  resume(): void {
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }
}

class AudioLayerInstance {
  source: AudioBufferSourceNode | MediaElementAudioSourceNode;
  gainNode: GainNode;
  audioElement?: HTMLAudioElement; // For streaming playback
  onEnded?: () => void; // Track-end callback for playlist mode

  constructor(
    source: AudioBufferSourceNode | MediaElementAudioSourceNode,
    gainNode: GainNode,
    audioElement?: HTMLAudioElement,
    onEnded?: () => void
  ) {
    this.source = source;
    this.gainNode = gainNode;
    this.audioElement = audioElement;
    this.onEnded = onEnded;
  }
}
