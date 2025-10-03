export interface AudioLayer {
  id: string;
  url: string;
  name: string;
  thumb?: string;
  volume: number;
}

export interface Scene {
  id: string;
  label: string;
  icon: string;
  environment?: AudioLayer;
  weather?: AudioLayer;
  music?: AudioLayer;
  oneshots: OneShot[];
}

export interface OneShot {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export type LayerType = "environment" | "weather" | "music";
