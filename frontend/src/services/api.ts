import type { Scene, MusicTag } from "../types";

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
  tags?: MusicTag[];
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

  async createScene(scene: Omit<Scene, "oneshots"> & { oneshots: number[] }): Promise<{ success: boolean; id: string }> {
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

  async updateScene(id: string, scene: Partial<Omit<Scene, "id" | "oneshots"> & { oneshots: number[] }>): Promise<{ success: boolean; id: string }> {
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

  // Music tag methods
  async getAllMusicTags(): Promise<MusicTag[]> {
    const response = await fetch(`${API_BASE}/music/tags`);
    if (!response.ok) {
      throw new Error("Failed to fetch music tags");
    }
    return response.json();
  }

  async createMusicTag(name: string, color?: string): Promise<{ success: boolean; tag: MusicTag }> {
    const response = await fetch(`${API_BASE}/music/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) {
      throw new Error("Failed to create music tag");
    }
    return response.json();
  }

  async updateMusicTag(id: number, name: string, color?: string): Promise<{ success: boolean; tag: MusicTag }> {
    const response = await fetch(`${API_BASE}/music/tags/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!response.ok) {
      throw new Error("Failed to update music tag");
    }
    return response.json();
  }

  async deleteMusicTag(id: number): Promise<{ success: boolean; id: number }> {
    const response = await fetch(`${API_BASE}/music/tags/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to delete music tag");
    }
    return response.json();
  }

  async getTagsForAudioFile(audioFileId: number): Promise<MusicTag[]> {
    const response = await fetch(`${API_BASE}/music/${audioFileId}/tags`);
    if (!response.ok) {
      throw new Error("Failed to fetch tags for audio file");
    }
    return response.json();
  }

  async addTagToAudioFile(audioFileId: number, tagId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/music/${audioFileId}/tags/${tagId}`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error("Failed to add tag to audio file");
    }
    return response.json();
  }

  async removeTagFromAudioFile(audioFileId: number, tagId: number): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/music/${audioFileId}/tags/${tagId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error("Failed to remove tag from audio file");
    }
    return response.json();
  }

  async getAudioFilesByTag(tagId: number): Promise<AudioFile[]> {
    const response = await fetch(`${API_BASE}/music/by-tag/${tagId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch audio files by tag");
    }
    return response.json();
  }
}

export const api = new ApiClient();
