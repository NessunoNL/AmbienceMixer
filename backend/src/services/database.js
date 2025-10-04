import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || '/app/data/ambience.db';

class DatabaseService {
  constructor() {
    this.db = new Database(DB_PATH, { verbose: console.log });
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  initialize() {
    const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8');
    this.db.exec(schema);
    console.log('✓ Database initialized');
  }

  // Audio files methods
  insertAudioFile(audioData) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO audio_files (path, name, category, duration, format, file_size)
      VALUES (@path, @name, @category, @duration, @format, @file_size)
    `);
    return stmt.run(audioData);
  }

  getAllAudioFiles() {
    const stmt = this.db.prepare('SELECT * FROM audio_files ORDER BY category, name');
    return stmt.all();
  }

  getAudioFilesByCategory(category) {
    const stmt = this.db.prepare('SELECT * FROM audio_files WHERE category = ? ORDER BY name');
    return stmt.all(category);
  }

  getAudioFileById(id) {
    const stmt = this.db.prepare('SELECT * FROM audio_files WHERE id = ?');
    return stmt.get(id);
  }

  deleteAllAudioFiles() {
    const stmt = this.db.prepare('DELETE FROM audio_files');
    return stmt.run();
  }

  // Scenes methods
  getAllScenes() {
    const stmt = this.db.prepare('SELECT * FROM scenes ORDER BY created_at DESC');
    return stmt.all();
  }

  getSceneById(id) {
    const stmt = this.db.prepare('SELECT * FROM scenes WHERE id = ?');
    return stmt.get(id);
  }

  insertScene(scene) {
    const stmt = this.db.prepare(`
      INSERT INTO scenes (id, label, icon, environment_id, weather_id, music_id, oneshots)
      VALUES (@id, @label, @icon, @environment_id, @weather_id, @music_id, @oneshots)
    `);
    return stmt.run(scene);
  }

  updateScene(id, scene) {
    const stmt = this.db.prepare(`
      UPDATE scenes
      SET label = @label,
          icon = @icon,
          environment_id = @environment_id,
          weather_id = @weather_id,
          music_id = @music_id,
          oneshots = @oneshots,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    return stmt.run({ ...scene, id });
  }

  deleteScene(id) {
    const stmt = this.db.prepare('DELETE FROM scenes WHERE id = ?');
    return stmt.run(id);
  }

  close() {
    this.db.close();
  }
}

export default new DatabaseService();
