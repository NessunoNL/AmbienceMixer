import express from 'express';
import db from '../services/database.js';

const router = express.Router();

// Get all scenes
router.get('/', (req, res) => {
  try {
    const scenes = db.getAllScenes();

    // Parse oneshots JSON for each scene
    const parsedScenes = scenes.map(scene => ({
      ...scene,
      oneshots: scene.oneshots ? JSON.parse(scene.oneshots) : [],
    }));

    res.json(parsedScenes);
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

    res.json({
      ...scene,
      oneshots: scene.oneshots ? JSON.parse(scene.oneshots) : [],
    });
  } catch (err) {
    console.error('Error fetching scene:', err);
    res.status(500).json({ error: 'Failed to fetch scene' });
  }
});

// Create new scene
router.post('/', (req, res) => {
  try {
    const { id, label, icon, environment_id, weather_id, music_id, oneshots } = req.body;

    if (!id || !label || !icon) {
      return res.status(400).json({ error: 'Missing required fields: id, label, icon' });
    }

    const sceneData = {
      id,
      label,
      icon,
      environment_id: environment_id || null,
      weather_id: weather_id || null,
      music_id: music_id || null,
      oneshots: JSON.stringify(oneshots || []),
    };

    db.insertScene(sceneData);
    res.status(201).json({ success: true, id });
  } catch (err) {
    console.error('Error creating scene:', err);
    res.status(500).json({ error: 'Failed to create scene' });
  }
});

// Update existing scene
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { label, icon, environment_id, weather_id, music_id, oneshots } = req.body;

    const existing = db.getSceneById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const sceneData = {
      label: label || existing.label,
      icon: icon || existing.icon,
      environment_id: environment_id !== undefined ? environment_id : existing.environment_id,
      weather_id: weather_id !== undefined ? weather_id : existing.weather_id,
      music_id: music_id !== undefined ? music_id : existing.music_id,
      oneshots: JSON.stringify(oneshots || []),
    };

    db.updateScene(id, sceneData);
    res.json({ success: true, id });
  } catch (err) {
    console.error('Error updating scene:', err);
    res.status(500).json({ error: 'Failed to update scene' });
  }
});

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
