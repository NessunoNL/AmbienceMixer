import express from 'express';
import db from '../services/database.js';

const router = express.Router();

// One-time migration endpoint to add volume columns
router.post('/add-volume-columns', (req, res) => {
  try {
    console.log('[Migration] Starting: adding volume columns to scenes table');

    // Check if columns already exist
    const testQuery = db.db.prepare('SELECT environment_volume FROM scenes LIMIT 1');
    try {
      testQuery.get();
      return res.json({
        success: true,
        message: 'Volume columns already exist',
        alreadyExists: true
      });
    } catch (err) {
      // Columns don't exist, add them
      console.log('[Migration] Adding environment_volume column...');
      db.db.exec('ALTER TABLE scenes ADD COLUMN environment_volume INTEGER DEFAULT 70');

      console.log('[Migration] Adding weather_volume column...');
      db.db.exec('ALTER TABLE scenes ADD COLUMN weather_volume INTEGER DEFAULT 45');

      console.log('[Migration] Adding music_volume column...');
      db.db.exec('ALTER TABLE scenes ADD COLUMN music_volume INTEGER DEFAULT 60');

      console.log('[Migration] Complete: volume columns added successfully');

      return res.json({
        success: true,
        message: 'Volume columns added successfully',
        columnsAdded: ['environment_volume', 'weather_volume', 'music_volume']
      });
    }
  } catch (err) {
    console.error('[Migration] Error:', err);
    res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: err.message
    });
  }
});

export default router;
