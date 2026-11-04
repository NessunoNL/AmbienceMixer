import { readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { parseFile } from 'music-metadata';
import db from './database.js';

const AUDIO_DIR = process.env.AUDIO_DIR || '/app/audio';
const SUPPORTED_FORMATS = ['.mp3', '.wav'];

export class AudioScanner {
  constructor(audioDir = AUDIO_DIR) {
    this.audioDir = audioDir;
    this.pendingScan = null;
  }

  // Startup and manual rescans share one operation, avoiding overlapping snapshots.
  scanDirectory() {
    if (!this.pendingScan) {
      this.pendingScan = this.performScan().finally(() => { this.pendingScan = null; });
    }
    return this.pendingScan;
  }

  async performScan() {
    console.log(`Scanning audio directory: ${this.audioDir}`);
    const startTime = Date.now();
    const scannedPaths = new Set();
    const completeCategories = new Set();
    const updates = [];
    const warnings = [];
    const warn = (category, error, file) => {
      const warning = { category, ...(file ? { file } : {}), message: error.message };
      warnings.push(warning);
      console.warn('Audio scan incomplete:', warning);
    };

    for (const category of ['environment', 'weather', 'music', 'oneshots']) {
      const categoryPath = join(this.audioDir, category);
      let files;
      try {
        files = readdirSync(categoryPath);
      } catch (error) {
        warn(category, error);
        continue;
      }
      let complete = true;
      for (const file of files) {
        const ext = extname(file).toLowerCase();
        if (!SUPPORTED_FORMATS.includes(ext)) continue;
        const filePath = join(categoryPath, file);
        const audioPath = `/audio/${category}/${file}`;
        // Presence is independent of whether metadata can be read successfully.
        scannedPaths.add(audioPath);
        try {
          const stats = statSync(filePath);
          if (!stats.isFile()) continue; // Library folders remain flat.
          const metadata = await this.extractMetadata(filePath);
          updates.push({
            path: audioPath,
            name: this.formatFileName(basename(file, extname(file))),
            category,
            duration: metadata.duration ?? null,
            format: ext.substring(1),
            file_size: stats.size,
          });
        } catch (error) {
          complete = false;
          warn(category, error, file);
        }
      }
      if (complete) completeCategories.add(category);
    }

    // Commit once after asynchronous I/O. A failed DB write cannot leave a half scan.
    const deletedCount = db.db.transaction(() => {
      for (const audio of updates) db.insertAudioFile(audio);
      let removed = 0;
      for (const file of db.getAllAudioFiles()) {
        if (completeCategories.has(file.category) && !scannedPaths.has(file.path)) {
          db.deleteAudioFileByPath(file.path);
          removed++;
        }
      }
      return removed;
    })();
    const result = {
      totalFiles: updates.length, deletedCount, duration: Date.now() - startTime,
      partial: warnings.length > 0, warnings,
    };
    console.log('Audio scan finished:', result);
    return result;
  }

  async extractMetadata(filePath) {
    // Let failures reach the scan policy; never overwrite good metadata with {}.
    const metadata = await parseFile(filePath, { duration: true });
    return { duration: metadata.format.duration };
  }

  formatFileName(name) {
    // Convert "forest-ambient" or "forest_ambient" to "Forest Ambient"
    return name
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  getLibrary() {
    const files = db.getAllAudioFiles();
    const categories = new Map(db.getSoundCategories().map(category => [category.id, category]));

    // Group by category
    const library = {
      environment: [],
      weather: [],
      music: [],
      oneshots: [],
    };

    for (const file of files) {
      const audioFile = {
        id: file.id,
        name: file.name,
        url: file.path, // Frontend will use this to construct the stream URL
        duration: file.duration,
        format: file.format,
        volume: 0.7, // Default volume
        soundCategoryId: file.sound_category_id ?? null,
        soundCategory: categories.get(file.sound_category_id) ?? null,
      };

      // Add tags for music files
      if (file.category === 'music') {
        audioFile.tags = db.getTagsForAudioFile(file.id);
      }

      library[file.category].push(audioFile);
    }

    return library;
  }
}

export default new AudioScanner();
