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

export interface Scene {
  id: string;
  label: string;
  icon: string;
  environment?: AudioLayer;
  weather?: AudioLayer;
  music?: AudioLayer;
  oneshots: OneShot[];
  environmentVolume?: number;
  weatherVolume?: number;
  musicVolume?: number;
  musicMode?: MusicPlaybackMode;
  musicTagId?: number;
}

export interface OneShot {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export type LayerType = "environment" | "weather" | "music";
