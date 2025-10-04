import type { LayerType } from "./types";

export class AudioEngine {
  private audioContext: AudioContext;
  private layers: Map<LayerType, AudioLayerInstance> = new Map();
  private masterGain: GainNode;

  constructor() {
    this.audioContext = new AudioContext();
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  async loadLayer(type: LayerType, url: string, volume: number = 1, crossfadeDuration: number = 1.5): Promise<void> {
    // Get existing layer for crossfade
    const oldLayer = this.layers.get(type);
    const currentTime = this.audioContext.currentTime;
    const timeConstant = crossfadeDuration / 5;

    // If there's an old layer, fade it out while we fade in the new one
    if (oldLayer) {
      oldLayer.gainNode.gain.cancelScheduledValues(currentTime);
      oldLayer.gainNode.gain.setValueAtTime(oldLayer.gainNode.gain.value, currentTime);
      oldLayer.gainNode.gain.setTargetAtTime(0, currentTime, timeConstant);

      // Schedule cleanup after crossfade completes
      setTimeout(() => {
        if (oldLayer.audioElement) {
          oldLayer.audioElement.pause();
          oldLayer.audioElement.currentTime = 0;
        } else {
          (oldLayer.source as AudioBufferSourceNode).stop();
        }
      }, crossfadeDuration * 1000 * 5); // Wait for exponential fade to complete (~5 time constants)
    }

    try {
      // Use streaming playback for looping layers (faster load times)
      const audio = new Audio(url);
      audio.loop = true;
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

      const layer = new AudioLayerInstance(source, gainNode, audio);
      this.layers.set(type, layer);

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

    if (fadeOut) {
      const durationMs = fadeDuration * 1000;
      await this.crossfadeLayer(type, 0, durationMs);
      setTimeout(() => {
        // Handle both streaming and buffer-based sources
        if (layer.audioElement) {
          layer.audioElement.pause();
          layer.audioElement.currentTime = 0;
        } else {
          (layer.source as AudioBufferSourceNode).stop();
        }
        this.layers.delete(type);
      }, durationMs * 5); // Wait for exponential fade to complete (~5 time constants)
    } else {
      // Handle both streaming and buffer-based sources
      if (layer.audioElement) {
        layer.audioElement.pause();
        layer.audioElement.currentTime = 0;
      } else {
        (layer.source as AudioBufferSourceNode).stop();
      }
      this.layers.delete(type);
    }
  }

  async playOneShot(url: string, volume: number = 0.8): Promise<void> {
    try {
      // Duck music layer
      const musicLayer = this.layers.get("music");
      const originalMusicVolume = musicLayer?.gainNode.gain.value ?? 0;

      if (musicLayer) {
        await this.crossfadeLayer("music", originalMusicVolume * 0.3, 200);
      }

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

      // Restore music after one-shot finishes
      source.onended = async () => {
        if (musicLayer) {
          await this.crossfadeLayer("music", originalMusicVolume, 500);
        }
      };
    } catch (error) {
      console.error("Failed to play one-shot:", error);
    }
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

  constructor(
    source: AudioBufferSourceNode | MediaElementAudioSourceNode,
    gainNode: GainNode,
    audioElement?: HTMLAudioElement
  ) {
    this.source = source;
    this.gainNode = gainNode;
    this.audioElement = audioElement;
  }
}
