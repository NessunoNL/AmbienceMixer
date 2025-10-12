import express from 'express';
import db from '../services/database.js';

const router = express.Router();

// One-time migration endpoint to add volume columns
router.post('/add-volume-columns', (req, res) => {
  console.log('[Migration] Starting: checking for volume columns in scenes table');

  try {
    // Check if columns exist using PRAGMA table_info
    const columns = db.db.prepare('PRAGMA table_info(scenes)').all();
    const columnNames = columns.map(col => col.name);

    console.log('[Migration] Existing columns:', columnNames);

    const hasEnvironmentVolume = columnNames.includes('environment_volume');
    const hasWeatherVolume = columnNames.includes('weather_volume');
    const hasMusicVolume = columnNames.includes('music_volume');

    if (hasEnvironmentVolume && hasWeatherVolume && hasMusicVolume) {
      console.log('[Migration] All volume columns already exist');
      return res.json({
        success: true,
        message: 'Volume columns already exist',
        alreadyExists: true
      });
    }

    // Add missing columns
    const columnsAdded = [];

    if (!hasEnvironmentVolume) {
      console.log('[Migration] Adding environment_volume column...');
      db.db.exec('ALTER TABLE scenes ADD COLUMN environment_volume INTEGER DEFAULT 70');
      columnsAdded.push('environment_volume');
    }

    if (!hasWeatherVolume) {
      console.log('[Migration] Adding weather_volume column...');
      db.db.exec('ALTER TABLE scenes ADD COLUMN weather_volume INTEGER DEFAULT 45');
      columnsAdded.push('weather_volume');
    }

    if (!hasMusicVolume) {
      console.log('[Migration] Adding music_volume column...');
      db.db.exec('ALTER TABLE scenes ADD COLUMN music_volume INTEGER DEFAULT 60');
      columnsAdded.push('music_volume');
    }

    console.log('[Migration] Complete: added', columnsAdded.join(', '));

    return res.json({
      success: true,
      message: `Added ${columnsAdded.length} volume column(s)`,
      columnsAdded
    });

  } catch (err) {
    console.error('[Migration] Error:', err);
    return res.status(500).json({
      success: false,
      error: 'Migration failed',
      details: err.message
    });
  }
});

export default router;
