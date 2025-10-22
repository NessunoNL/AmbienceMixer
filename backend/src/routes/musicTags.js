import { Router } from 'express';
import db from '../services/database.js';

const router = Router();

// Get all music tags
router.get('/tags', (req, res) => {
  try {
    const tags = db.getAllMusicTags();
    res.json(tags);
  } catch (error) {
    console.error('Failed to get music tags:', error);
    res.status(500).json({ error: 'Failed to fetch music tags' });
  }
});

// Create a new music tag
router.post('/tags', (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const result = db.insertMusicTag({
      name: name.trim(),
      color: color || null,
    });

    const newTag = db.getMusicTagById(result.lastInsertRowid);
    res.json({ success: true, tag: newTag });
  } catch (error) {
    console.error('Failed to create music tag:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Tag name already exists' });
    }
    res.status(500).json({ error: 'Failed to create music tag' });
  }
});

// Update a music tag
router.put('/tags/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const existing = db.getMusicTagById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    db.updateMusicTag(id, {
      name: name || existing.name,
      color: color !== undefined ? color : existing.color,
    });

    const updatedTag = db.getMusicTagById(id);
    res.json({ success: true, tag: updatedTag });
  } catch (error) {
    console.error('Failed to update music tag:', error);
    res.status(500).json({ error: 'Failed to update music tag' });
  }
});

// Delete a music tag
router.delete('/tags/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.deleteMusicTag(id);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Failed to delete music tag:', error);
    res.status(500).json({ error: 'Failed to delete music tag' });
  }
});

// Get tags for a specific music file
router.get('/:audioFileId/tags', (req, res) => {
  try {
    const { audioFileId } = req.params;
    const tags = db.getTagsForAudioFile(audioFileId);
    res.json(tags);
  } catch (error) {
    console.error('Failed to get tags for audio file:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// Add a tag to a music file
router.post('/:audioFileId/tags/:tagId', (req, res) => {
  try {
    const { audioFileId, tagId } = req.params;
    db.addTagToAudioFile(audioFileId, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to add tag to audio file:', error);
    res.status(500).json({ error: 'Failed to add tag' });
  }
});

// Remove a tag from a music file
router.delete('/:audioFileId/tags/:tagId', (req, res) => {
  try {
    const { audioFileId, tagId } = req.params;
    db.removeTagFromAudioFile(audioFileId, tagId);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to remove tag from audio file:', error);
    res.status(500).json({ error: 'Failed to remove tag' });
  }
});

// Get all music files with a specific tag
router.get('/by-tag/:tagId', (req, res) => {
  try {
    const { tagId } = req.params;
    const audioFiles = db.getAudioFilesByTag(tagId);

    // Format as frontend AudioLayer objects
    const files = audioFiles.map(file => ({
      id: file.id,
      name: file.name,
      url: file.path,
      duration: file.duration,
      format: file.format,
      volume: 0.7,
    }));

    res.json(files);
  } catch (error) {
    console.error('Failed to get audio files by tag:', error);
    res.status(500).json({ error: 'Failed to fetch audio files' });
  }
});

export default router;
