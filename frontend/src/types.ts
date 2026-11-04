export interface MusicTag {
  id: number;
  name: string;
  color?: string;
}

export interface AudioLayer {
  id: string;
  url: string;
  name: string;
  thumb?: string;
  volume: number;
  duration?: number;
  format?: string;
  tags?: MusicTag[];
}

export type MusicPlaybackMode = "single-loop" | "tag-shuffle";

/** Scene mix levels use 0–100; AudioLayer.volume retains its 0–1 convention. */
export interface SceneAmbienceInput {
  audioId: number;
  volume: number;
  enabled?: boolean;
}

export interface SceneAmbience extends SceneAmbienceInput {
  enabled: boolean;
  audio: AudioLayer | null;
}

/** Write contract differs from hydrated Scene responses. */
export interface SceneWrite {
  id: string;
  label: string;
  icon: string;
  environment_id?: number | null;
  weather_id?: number | null;
  music_id?: number | null;
  environmentVolume?: number;
  weatherVolume?: number;
  musicVolume?: number;
  oneshots?: number[];
  ambiences?: SceneAmbienceInput[];
}

export interface Scene {
  id: string;
  label: string;
  icon: string;
  environment?: AudioLayer;
  weather?: AudioLayer;
  music?: AudioLayer;
  oneshots: OneShot[];
  /** Optional while legacy UI constructors are still in use; API always returns it. */
  ambiences?: SceneAmbience[];
  environmentVolume?: number;
  weatherVolume?: number;
  musicVolume?: number;
  musicMode?: MusicPlaybackMode;
  musicTagId?: number | null;
}

export interface OneShot {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export type LayerType = "environment" | "weather" | "music";
