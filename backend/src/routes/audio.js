import express from 'express';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';
import db from '../services/database.js';
import audioScanner from '../services/audioScanner.js';

const router = express.Router();
const AUDIO_DIR = process.env.AUDIO_DIR || '/app/audio';

// Get audio library grouped by category
router.get('/library', (req, res) => {
  try {
    const library = audioScanner.getLibrary();
    res.json(library);
  } catch (err) {
    console.error('Error fetching library:', err);
    res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// Get single audio file metadata
router.get('/:id', (req, res) => {
  try {
    const audio = db.getAudioFileById(parseInt(req.params.id));
    if (!audio) {
      return res.status(404).json({ error: 'Audio file not found' });
    }
    res.json(audio);
  } catch (err) {
    console.error('Error fetching audio:', err);
    res.status(500).json({ error: 'Failed to fetch audio file' });
  }
});

// Stream audio file with range support (for seeking)
router.get('/:id/stream', (req, res) => {
  try {
    const audio = db.getAudioFileById(parseInt(req.params.id));
    if (!audio) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    // Convert virtual path to real filesystem path
    // audio.path is like "/audio/environment/forest.mp3"
    const filePath = join(AUDIO_DIR, audio.path.replace('/audio/', ''));
    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Set content type based on format
    const mimeTypes = {
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
    };
    const contentType = mimeTypes[audio.format] || 'application/octet-stream';

    if (range) {
      // Handle range request for seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });

      const stream = createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      // No range, send entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      });

      const stream = createReadStream(filePath);
      stream.pipe(res);
    }
  } catch (err) {
    console.error('Error streaming audio:', err);
    res.status(500).json({ error: 'Failed to stream audio file' });
  }
});

// Trigger audio library rescan
router.post('/scan', async (req, res) => {
  try {
    const result = await audioScanner.scanDirectory();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error scanning directory:', err);
    res.status(500).json({ error: 'Failed to scan audio directory' });
  }
});

export default router;
