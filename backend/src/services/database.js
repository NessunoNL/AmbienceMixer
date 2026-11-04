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
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  initialize() {
    const schema = readFileSync(join(__dirname, '../db/schema.sql'), 'utf8');
    this.db.exec(schema);

    // Run migrations
    this.db.transaction(() => this.runMigrations())();

    console.log('✓ Database initialized');
  }

  runMigrations() {
    this.db.exec(`CREATE TABLE IF NOT EXISTS sound_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(trim(name)) > 0)
    )`);
    if (!this.db.pragma('table_info(audio_files)').some(col => col.name === 'sound_category_id')) {
      this.db.exec('ALTER TABLE audio_files ADD COLUMN sound_category_id INTEGER REFERENCES sound_categories(id) ON DELETE SET NULL');
    }
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_audio_sound_category ON audio_files(sound_category_id)');

    // Older installations may predate the manual volume-column migration.
    const columns = this.db.pragma('table_info(scenes)').map(col => col.name);
    for (const [name, fallback] of Object.entries({ environment_volume: 70, weather_volume: 45, music_volume: 60 })) {
      if (!columns.includes(name)) this.db.exec(`ALTER TABLE scenes ADD COLUMN ${name} INTEGER DEFAULT ${fallback}`);
    }
    // Check if music_mode column exists
    const scenesInfo = this.db.pragma('table_info(scenes)');
    const hasMusicMode = scenesInfo.some(col => col.name === 'music_mode');
    const hasMusicTagId = scenesInfo.some(col => col.name === 'music_tag_id');

    // Add music playback columns if they don't exist
    if (!hasMusicMode) {
      console.log('  ✓ Adding music_mode column to scenes');
      this.db.exec(`ALTER TABLE scenes ADD COLUMN music_mode TEXT DEFAULT 'single-loop' CHECK(music_mode IN ('single-loop', 'tag-shuffle'))`);
    }

    if (!hasMusicTagId) {
      console.log('  ✓ Adding music_tag_id column to scenes');
      this.db.exec(`ALTER TABLE scenes ADD COLUMN music_tag_id INTEGER REFERENCES music_tags(id) ON DELETE SET NULL`);
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS scene_ambiences (
        scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
        audio_id INTEGER NOT NULL REFERENCES audio_files(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK(position >= 0),
        volume REAL NOT NULL CHECK(volume >= 0 AND volume <= 100),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
        PRIMARY KEY (scene_id, audio_id),
        UNIQUE (scene_id, position)
      );
    `);
    if (!this.db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get('scene-ambiences-v1')) {
      this.db.exec(`
        INSERT INTO scene_ambiences (scene_id, audio_id, position, volume, enabled)
        SELECT s.id, s.weather_id, 0, COALESCE(s.weather_volume, 45), 1
        FROM scenes s JOIN audio_files a ON a.id = s.weather_id
        WHERE a.category = 'weather';
      `);
      this.db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run('scene-ambiences-v1');
    }
  }

  // Audio files methods
  insertAudioFile(audioData) {
    const stmt = this.db.prepare(`
      INSERT INTO audio_files (path, name, category, duration, format, file_size)
      VALUES (@path, @name, @category, @duration, @format, @file_size)
      ON CONFLICT(path) DO UPDATE SET
        name = excluded.name,
        category = excluded.category,
        duration = excluded.duration,
        format = excluded.format,
        file_size = excluded.file_size
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

  deleteAudioFileByPath(path) {
    const stmt = this.db.prepare('DELETE FROM audio_files WHERE path = ?');
    return stmt.run(path);
  }

  // User-facing sound categories are independent of the physical audio folders.
  getSoundCategories() {
    return this.db.prepare('SELECT id, name FROM sound_categories ORDER BY name COLLATE NOCASE').all();
  }

  getSoundCategory(id) {
    return this.db.prepare('SELECT id, name FROM sound_categories WHERE id = ?').get(id);
  }

  createSoundCategory(name) {
    const result = this.db.prepare('INSERT INTO sound_categories (name) VALUES (?)').run(name);
    return this.getSoundCategory(result.lastInsertRowid);
  }

  renameSoundCategory(id, name) {
    this.db.prepare('UPDATE sound_categories SET name = ? WHERE id = ?').run(name, id);
    return this.getSoundCategory(id);
  }

  deleteSoundCategory(id) {
    return this.db.prepare('DELETE FROM sound_categories WHERE id = ?').run(id);
  }

  assignSoundCategory(audioId, categoryId) {
    return this.db.prepare("UPDATE audio_files SET sound_category_id = ? WHERE id = ? AND category IN ('weather', 'oneshots')").run(categoryId, audioId);
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
      INSERT INTO scenes (id, label, icon, environment_id, weather_id, music_id, oneshots, environment_volume, weather_volume, music_volume)
      VALUES (@id, @label, @icon, @environment_id, @weather_id, @music_id, @oneshots, @environment_volume, @weather_volume, @music_volume)
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
          environment_volume = @environment_volume,
          weather_volume = @weather_volume,
          music_volume = @music_volume,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    return stmt.run({ ...scene, id });
  }

  getSceneAmbiences(id) {
    return this.db.prepare('SELECT audio_id AS audioId, volume, enabled FROM scene_ambiences WHERE scene_id = ? ORDER BY position')
      .all(id).map(row => ({ ...row, enabled: Boolean(row.enabled) }));
  }

  saveScene(scene, ambiences, updating = false) {
    return this.db.transaction(() => {
      const result = updating ? this.updateScene(scene.id, scene) : this.insertScene(scene);
      this.db.prepare('DELETE FROM scene_ambiences WHERE scene_id = ?').run(scene.id);
      const insert = this.db.prepare('INSERT INTO scene_ambiences (scene_id, audio_id, position, volume, enabled) VALUES (?, ?, ?, ?, ?)');
      ambiences.forEach((entry, position) => insert.run(scene.id, entry.audioId, position, entry.volume, Number(entry.enabled)));
      return result;
    })();
  }

  deleteScene(id) {
    const stmt = this.db.prepare('DELETE FROM scenes WHERE id = ?');
    return stmt.run(id);
  }

  // Music tags methods
  getAllMusicTags() {
    const stmt = this.db.prepare('SELECT * FROM music_tags ORDER BY name');
    return stmt.all();
  }

  getMusicTagById(id) {
    const stmt = this.db.prepare('SELECT * FROM music_tags WHERE id = ?');
    return stmt.get(id);
  }

  insertMusicTag(tag) {
    const stmt = this.db.prepare(`
      INSERT INTO music_tags (name, color)
      VALUES (@name, @color)
    `);
    return stmt.run(tag);
  }

  updateMusicTag(id, tag) {
    const stmt = this.db.prepare(`
      UPDATE music_tags
      SET name = @name, color = @color
      WHERE id = @id
    `);
    return stmt.run({ ...tag, id });
  }

  deleteMusicTag(id) {
    const stmt = this.db.prepare('DELETE FROM music_tags WHERE id = ?');
    return stmt.run(id);
  }

  // Audio file tags methods
  getTagsForAudioFile(audioFileId) {
    const stmt = this.db.prepare(`
      SELECT mt.* FROM music_tags mt
      INNER JOIN audio_file_tags aft ON mt.id = aft.tag_id
      WHERE aft.audio_file_id = ?
      ORDER BY mt.name
    `);
    return stmt.all(audioFileId);
  }

  addTagToAudioFile(audioFileId, tagId) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO audio_file_tags (audio_file_id, tag_id)
      VALUES (?, ?)
    `);
    return stmt.run(audioFileId, tagId);
  }

  removeTagFromAudioFile(audioFileId, tagId) {
    const stmt = this.db.prepare(`
      DELETE FROM audio_file_tags
      WHERE audio_file_id = ? AND tag_id = ?
    `);
    return stmt.run(audioFileId, tagId);
  }

  getAudioFilesByTag(tagId) {
    const stmt = this.db.prepare(`
      SELECT af.* FROM audio_files af
      INNER JOIN audio_file_tags aft ON af.id = aft.audio_file_id
      WHERE aft.tag_id = ? AND af.category = 'music'
      ORDER BY af.name
    `);
    return stmt.all(tagId);
  }

  close() {
    this.db.close();
  }
}

export default new DatabaseService();
