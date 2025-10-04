import type { Scene } from "../types";

const API_BASE = "/api";

export interface AudioLibrary {
  environment: AudioFile[];
  weather: AudioFile[];
  music: AudioFile[];
  oneshots: AudioFile[];
}

export interface AudioFile {
  id: number;
  name: string;
  url: string;
  duration?: number;
  format: string;
  volume: number;
}

class ApiClient {
  // Audio library methods
  async getAudioLibrary(): Promise<AudioLibrary> {
    const response = await fetch(`${API_BASE}/audio/library`);
    if (!response.ok) {
      throw new Error("Failed to fetch audio library");
    }
    return response.json();
  }

  async triggerAudioScan(): Promise<{ success: boolean; totalFiles: number; duration: number }> {
    const response = await fetch(`${API_BASE}/audio/scan`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to trigger audio scan");
    }
    return response.json();
  }

  getAudioStreamUrl(id: number): string {
    return `${API_BASE}/audio/${id}/stream`;
  }

  // Scene methods
  async getScenes(): Promise<Scene[]> {
    const response = await fetch(`${API_BASE}/scenes`);
    if (!response.ok) {
      throw new Error("Failed to fetch scenes");
    }
    return response.json();
  }

  async createScene(scene: Omit<Scene, "oneshots"> & { oneshots: string[] }): Promise<{ success: boolean; id: string }> {
    const response = await fetch(`${API_BASE}/scenes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene),
    });
    if (!response.ok) {
      throw new Error("Failed to create scene");
    }
    return response.json();
  }

  async updateScene(id: string, scene: Partial<Omit<Scene, "id" | "oneshots"> & { oneshots: string[] }>): Promise<{ success: boolean; id: string }> {
    const response = await fetch(`${API_BASE}/scenes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene),
    });
    if (!response.ok) {
      throw new Error("Failed to update scene");
    }
    return response.json();
  }

  async deleteScene(id: string): Promise<{ success: boolean; id: string }> {
    const response = await fetch(`${API_BASE}/scenes/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete scene");
    }
    return response.json();
  }
}

export const api = new ApiClient();
