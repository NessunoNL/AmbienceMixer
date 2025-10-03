import type { Scene, AudioLayer, OneShot } from "./types";
import {
  Castle,
  Trees,
  Mountain,
  DoorOpen,
  Skull,
  Zap,
  Ghost,
  CloudLightning,
  Flame,
  CloudRain,
  Wind,
  Swords,
  Waves,
  Home,
  Music2,
  Sparkles,
  Bird,
  Ship,
  Footprints,
  Droplets,
  Snowflake,
  Shield,
  Heart,
  Siren,
  Church,
  Drum,
  Bell,
  Volume2,
} from "lucide-react";

// Using free ambient sounds from various sources
// These are placeholder URLs - you'll need to host your own audio files

// ==================== AUDIO LIBRARY ====================

export const environmentLibrary: AudioLayer[] = [
  {
    id: "dungeon-env",
    name: "Dungeon Ambience",
    url: "https://assets.mixkit.co/active_storage/sfx/2486/2486-preview.mp3",
    volume: 0.7,
  },
  {
    id: "forest-env",
    name: "Forest Ambience",
    url: "https://assets.mixkit.co/active_storage/sfx/2479/2479-preview.mp3",
    volume: 0.7,
  },
  {
    id: "cave-env",
    name: "Cave Drips",
    url: "https://assets.mixkit.co/active_storage/sfx/2489/2489-preview.mp3",
    volume: 0.6,
  },
  {
    id: "tavern-env",
    name: "Tavern Chatter",
    url: "https://assets.mixkit.co/active_storage/sfx/2470/2470-preview.mp3",
    volume: 0.6,
  },
  {
    id: "coast-env",
    name: "Ocean Waves",
    url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3",
    volume: 0.7,
  },
  {
    id: "city-env",
    name: "City Streets",
    url: "https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3",
    volume: 0.6,
  },
  {
    id: "mountain-env",
    name: "Mountain Wind",
    url: "https://assets.mixkit.co/active_storage/sfx/2486/2486-preview.mp3",
    volume: 0.6,
  },
  {
    id: "swamp-env",
    name: "Swamp Ambience",
    url: "https://assets.mixkit.co/active_storage/sfx/2479/2479-preview.mp3",
    volume: 0.7,
  },
  {
    id: "castle-env",
    name: "Castle Hall",
    url: "https://assets.mixkit.co/active_storage/sfx/2489/2489-preview.mp3",
    volume: 0.5,
  },
  {
    id: "temple-env",
    name: "Temple Echo",
    url: "https://assets.mixkit.co/active_storage/sfx/1726/1726-preview.mp3",
    volume: 0.6,
  },
];

export const weatherLibrary: AudioLayer[] = [
  {
    id: "light-rain",
    name: "Light Rain",
    url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3",
    volume: 0.5,
  },
  {
    id: "heavy-rain",
    name: "Heavy Rain",
    url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3",
    volume: 0.7,
  },
  {
    id: "thunderstorm",
    name: "Thunder Storm",
    url: "https://assets.mixkit.co/active_storage/sfx/2392/2392-preview.mp3",
    volume: 0.6,
  },
  {
    id: "wind-gentle",
    name: "Gentle Wind",
    url: "https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3",
    volume: 0.4,
  },
  {
    id: "wind-strong",
    name: "Strong Wind",
    url: "https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3",
    volume: 0.7,
  },
  {
    id: "blizzard",
    name: "Blizzard",
    url: "https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3",
    volume: 0.8,
  },
  {
    id: "drizzle",
    name: "Light Drizzle",
    url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3",
    volume: 0.4,
  },
  {
    id: "fog",
    name: "Foggy Atmosphere",
    url: "https://assets.mixkit.co/active_storage/sfx/2486/2486-preview.mp3",
    volume: 0.3,
  },
];

export const musicLibrary: AudioLayer[] = [
  {
    id: "battle-music",
    name: "Battle Theme",
    url: "https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3",
    volume: 0.6,
  },
  {
    id: "calm-music",
    name: "Calm Atmosphere",
    url: "https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3",
    volume: 0.5,
  },
  {
    id: "mysterious-music",
    name: "Mysterious Theme",
    url: "https://assets.mixkit.co/active_storage/sfx/2470/2470-preview.mp3",
    volume: 0.6,
  },
  {
    id: "epic-music",
    name: "Epic Adventure",
    url: "https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3",
    volume: 0.6,
  },
  {
    id: "sad-music",
    name: "Melancholy",
    url: "https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3",
    volume: 0.5,
  },
  {
    id: "tense-music",
    name: "Tense Atmosphere",
    url: "https://assets.mixkit.co/active_storage/sfx/2470/2470-preview.mp3",
    volume: 0.6,
  },
  {
    id: "peaceful-music",
    name: "Peaceful Rest",
    url: "https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3",
    volume: 0.4,
  },
  {
    id: "horror-music",
    name: "Horror Theme",
    url: "https://assets.mixkit.co/active_storage/sfx/2486/2486-preview.mp3",
    volume: 0.6,
  },
  {
    id: "victory-music",
    name: "Victory Fanfare",
    url: "https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3",
    volume: 0.7,
  },
  {
    id: "tavern-music",
    name: "Tavern Jig",
    url: "https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3",
    volume: 0.6,
  },
];

export const oneShotLibrary: OneShot[] = [
  { id: "door-slam", name: "Door Slam", url: "https://assets.mixkit.co/active_storage/sfx/2046/2046-preview.mp3", icon: "DoorOpen" },
  { id: "ghoul-hiss", name: "Ghoul Hiss", url: "https://assets.mixkit.co/active_storage/sfx/1765/1765-preview.mp3", icon: "Skull" },
  { id: "stone-creak", name: "Stone Creak", url: "https://assets.mixkit.co/active_storage/sfx/2489/2489-preview.mp3", icon: "Castle" },
  { id: "echo-clap", name: "Echo Clap", url: "https://assets.mixkit.co/active_storage/sfx/1726/1726-preview.mp3", icon: "Zap" },
  { id: "thunderclap", name: "Thunderclap", url: "https://assets.mixkit.co/active_storage/sfx/1745/1745-preview.mp3", icon: "CloudLightning" },
  { id: "flock-burst", name: "Flock Burst", url: "https://assets.mixkit.co/active_storage/sfx/1757/1757-preview.mp3", icon: "Bird" },
  { id: "distant-roar", name: "Distant Roar", url: "https://assets.mixkit.co/active_storage/sfx/1773/1773-preview.mp3", icon: "Flame" },
  { id: "rain-splash", name: "Rain Splash", url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3", icon: "CloudRain" },
  { id: "avalanche", name: "Avalanche", url: "https://assets.mixkit.co/active_storage/sfx/2489/2489-preview.mp3", icon: "Mountain" },
  { id: "wind-gust", name: "Wind Gust", url: "https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3", icon: "Wind" },
  { id: "eagle-cry", name: "Eagle Cry", url: "https://assets.mixkit.co/active_storage/sfx/1757/1757-preview.mp3", icon: "Bird" },
  { id: "war-horn", name: "War Horn", url: "https://assets.mixkit.co/active_storage/sfx/1726/1726-preview.mp3", icon: "Swords" },
  { id: "sword-clash", name: "Sword Clash", url: "https://assets.mixkit.co/active_storage/sfx/2046/2046-preview.mp3", icon: "Swords" },
  { id: "footsteps", name: "Footsteps", url: "https://assets.mixkit.co/active_storage/sfx/2046/2046-preview.mp3", icon: "Footprints" },
  { id: "bell-toll", name: "Bell Toll", url: "https://assets.mixkit.co/active_storage/sfx/1726/1726-preview.mp3", icon: "Bell" },
  { id: "magic-spell", name: "Magic Spell", url: "https://assets.mixkit.co/active_storage/sfx/1765/1765-preview.mp3", icon: "Sparkles" },
];

// ==================== SCENES ====================

export const mockScenes: Scene[] = [
  {
    id: "dungeon",
    label: "Dungeon • Drizzle • Tense",
    icon: "Castle",
    environment: {
      id: "dungeon-env",
      name: "Dungeon Ambience",
      url: "https://assets.mixkit.co/active_storage/sfx/2486/2486-preview.mp3", // Placeholder
      volume: 0.7,
    },
    weather: {
      id: "drizzle",
      name: "Light Rain",
      url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3", // Placeholder
      volume: 0.5,
    },
    music: {
      id: "tense-music",
      name: "Tense Atmosphere",
      url: "https://assets.mixkit.co/active_storage/sfx/2470/2470-preview.mp3", // Placeholder
      volume: 0.6,
    },
    oneshots: [
      {
        id: "door-slam",
        name: "Door Slam",
        url: "https://assets.mixkit.co/active_storage/sfx/2046/2046-preview.mp3",
        icon: "DoorOpen",
      },
      {
        id: "ghoul-hiss",
        name: "Ghoul Hiss",
        url: "https://assets.mixkit.co/active_storage/sfx/1765/1765-preview.mp3",
        icon: "Skull",
      },
      {
        id: "stone-creak",
        name: "Stone Creak",
        url: "https://assets.mixkit.co/active_storage/sfx/2489/2489-preview.mp3",
        icon: "Castle",
      },
      {
        id: "echo-clap",
        name: "Echo Clap",
        url: "https://assets.mixkit.co/active_storage/sfx/1726/1726-preview.mp3",
        icon: "Zap",
      },
    ],
  },
  {
    id: "jungle",
    label: "Jungle • Storm • Calm",
    icon: "Trees",
    environment: {
      id: "jungle-env",
      name: "Jungle Ambience",
      url: "https://assets.mixkit.co/active_storage/sfx/2479/2479-preview.mp3",
      volume: 0.7,
    },
    weather: {
      id: "storm",
      name: "Thunder Storm",
      url: "https://assets.mixkit.co/active_storage/sfx/2392/2392-preview.mp3",
      volume: 0.6,
    },
    music: {
      id: "calm-music",
      name: "Calm Atmosphere",
      url: "https://assets.mixkit.co/active_storage/sfx/2458/2458-preview.mp3",
      volume: 0.5,
    },
    oneshots: [
      {
        id: "flock-burst",
        name: "Flock Burst",
        url: "https://assets.mixkit.co/active_storage/sfx/1757/1757-preview.mp3",
        icon: "Ghost",
      },
      {
        id: "thunderclap",
        name: "Thunderclap",
        url: "https://assets.mixkit.co/active_storage/sfx/1745/1745-preview.mp3",
        icon: "CloudLightning",
      },
      {
        id: "distant-roar",
        name: "Distant Roar",
        url: "https://assets.mixkit.co/active_storage/sfx/1773/1773-preview.mp3",
        icon: "Flame",
      },
      {
        id: "rain-splash",
        name: "Rain Splash",
        url: "https://assets.mixkit.co/active_storage/sfx/2393/2393-preview.mp3",
        icon: "CloudRain",
      },
    ],
  },
  {
    id: "pass",
    label: "High Pass • Wind • Epic",
    icon: "Mountain",
    environment: {
      id: "mountain-env",
      name: "Mountain Wind",
      url: "https://assets.mixkit.co/active_storage/sfx/2486/2486-preview.mp3",
      volume: 0.6,
    },
    weather: {
      id: "wind",
      name: "Strong Wind",
      url: "https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3",
      volume: 0.7,
    },
    music: {
      id: "epic-music",
      name: "Epic Atmosphere",
      url: "https://assets.mixkit.co/active_storage/sfx/2462/2462-preview.mp3",
      volume: 0.6,
    },
    oneshots: [
      {
        id: "avalanche",
        name: "Avalanche Pebbles",
        url: "https://assets.mixkit.co/active_storage/sfx/2489/2489-preview.mp3",
        icon: "Mountain",
      },
      {
        id: "wind-gust",
        name: "Wind Gust",
        url: "https://assets.mixkit.co/active_storage/sfx/2390/2390-preview.mp3",
        icon: "Wind",
      },
      {
        id: "eagle-cry",
        name: "Eagle Cry",
        url: "https://assets.mixkit.co/active_storage/sfx/1757/1757-preview.mp3",
        icon: "Ghost",
      },
      {
        id: "war-horn",
        name: "War Horn",
        url: "https://assets.mixkit.co/active_storage/sfx/1726/1726-preview.mp3",
        icon: "Swords",
      },
    ],
  },
];

// Icon map for string-to-component conversion
export const iconMap: Record<string, any> = {
  Castle,
  Trees,
  Mountain,
  DoorOpen,
  Skull,
  Zap,
  Ghost,
  CloudLightning,
  Flame,
  CloudRain,
  Wind,
  Swords,
  Waves,
  Home,
  Music2,
  Sparkles,
  Bird,
  Ship,
  Footprints,
  Droplets,
  Snowflake,
  Shield,
  Heart,
  Siren,
  Church,
  Drum,
  Bell,
  Volume2,
};
