import express from 'express';
import db from '../services/database.js';
import { normalizeScenePayload, SceneValidationError } from '../services/scenePayload.js';

const router = express.Router();

// Helper function to hydrate scene with full audio layer objects
function hydrateScene(scene) {
  const hydrated = { ...scene };

  hydrated.ambiences = db.getSceneAmbiences(scene.id).map(entry => {
    const audio = db.getAudioFileById(entry.audioId);
    return { ...entry, audio: audio ? {
      id: String(audio.id), name: audio.name,
      url: `/api/audio/${audio.id}/stream`, volume: entry.volume / 100,
    } : null };
  });
  hydrated.musicMode = scene.music_mode;
  hydrated.musicTagId = scene.music_tag_id;

  // Hydrate environment layer
  if (scene.environment_id) {
    const envAudio = db.getAudioFileById(scene.environment_id);
    if (envAudio) {
      hydrated.environment = {
        id: envAudio.id.toString(),
        name: envAudio.name,
        url: `/api/audio/${envAudio.id}/stream`,
        volume: 0.7,
      };
    }
  }

  // Hydrate weather layer
  if (scene.weather_id) {
    const weatherAudio = db.getAudioFileById(scene.weather_id);
    if (weatherAudio) {
      hydrated.weather = {
        id: weatherAudio.id.toString(),
        name: weatherAudio.name,
        url: `/api/audio/${weatherAudio.id}/stream`,
        volume: 0.7,
      };
    }
  }

  // Hydrate music layer
  if (scene.music_id) {
    const musicAudio = db.getAudioFileById(scene.music_id);
    if (musicAudio) {
      hydrated.music = {
        id: musicAudio.id.toString(),
        name: musicAudio.name,
        url: `/api/audio/${musicAudio.id}/stream`,
        volume: 0.7,
      };
    }
  }

  // Hydrate one-shots
  const oneShotIds = scene.oneshots ? JSON.parse(scene.oneshots) : [];
  hydrated.oneshots = oneShotIds.map(id => {
    const audio = db.getAudioFileById(parseInt(id));
    if (audio) {
      return {
        id: audio.id.toString(),
        name: audio.name,
        url: `/api/audio/${audio.id}/stream`,
        icon: 'Volume2', // Generic speaker icon
      };
    }
    return null;
  }).filter(os => os !== null);

  // Include volume fields (with defaults for backward compatibility)
  hydrated.environmentVolume = scene.environment_volume ?? 70;
  hydrated.weatherVolume = scene.weather_volume ?? 45;
  hydrated.musicVolume = scene.music_volume ?? 60;

  // Remove database-specific fields
  delete hydrated.environment_id;
  delete hydrated.weather_id;
  delete hydrated.music_id;
  delete hydrated.environment_volume;
  delete hydrated.weather_volume;
  delete hydrated.music_volume;
  delete hydrated.created_at;
  delete hydrated.updated_at;

  return hydrated;
}

// Get all scenes
router.get('/', (req, res) => {
  try {
    const scenes = db.getAllScenes();
    const hydratedScenes = scenes.map(hydrateScene);
    res.json(hydratedScenes);
  } catch (err) {
    console.error('Error fetching scenes:', err);
    res.status(500).json({ error: 'Failed to fetch scenes' });
  }
});

// Get single scene
router.get('/:id', (req, res) => {
  try {
    const scene = db.getSceneById(req.params.id);
    if (!scene) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const hydratedScene = hydrateScene(scene);
    res.json(hydratedScene);
  } catch (err) {
    console.error('Error fetching scene:', err);
    res.status(500).json({ error: 'Failed to fetch scene' });
  }
});

// Create/update use one validated payload and an atomic parent/children write.
function writeScene(req, res, updating) {
  try {
    const id = updating ? req.params.id : req.body?.id;
    const existing = updating ? db.getSceneById(id) : undefined;
    if (updating && !existing) return res.status(404).json({ error: 'Scene not found' });
    const { scene, ambiences } = normalizeScenePayload(req.body, existing, db, id);
    if (!updating && db.getSceneById(id)) return res.status(409).json({ error: 'Scene already exists' });
    db.saveScene(scene, ambiences, updating);
    return res.status(updating ? 200 : 201).json({ success: true, id });
  } catch (err) {
    if (err instanceof SceneValidationError) return res.status(400).json({ error: err.message });
    console.error('Error saving scene:', err);
    return res.status(500).json({ error: 'Failed to save scene' });
  }
}
router.post('/', (req, res) => writeScene(req, res, false));
router.put('/:id', (req, res) => writeScene(req, res, true));

// Delete scene
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.getSceneById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    db.deleteScene(id);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Error deleting scene:', err);
    res.status(500).json({ error: 'Failed to delete scene' });
  }
});

export default router;
