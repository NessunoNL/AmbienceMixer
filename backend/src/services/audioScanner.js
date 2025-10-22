import { readdirSync, statSync } from 'fs';
import { join, extname, basename } from 'path';
import { parseFile } from 'music-metadata';
import db from './database.js';

const AUDIO_DIR = process.env.AUDIO_DIR || '/app/audio';
const SUPPORTED_FORMATS = ['.mp3', '.wav'];

class AudioScanner {
  async scanDirectory() {
    console.log(`🔍 Scanning audio directory: ${AUDIO_DIR}`);
    const startTime = Date.now();

    // Note: Using UPSERT to preserve IDs - scenes remain valid after rescans
    // Track scanned paths to identify deleted files
    const scannedPaths = new Set();

    const categories = ['environment', 'weather', 'music', 'oneshots'];
    let totalFiles = 0;

    for (const category of categories) {
      const categoryPath = join(AUDIO_DIR, category);

      try {
        const files = readdirSync(categoryPath);

        for (const file of files) {
          const filePath = join(categoryPath, file);
          const ext = extname(file).toLowerCase();

          if (!SUPPORTED_FORMATS.includes(ext)) {
            continue;
          }

          try {
            const stats = statSync(filePath);
            const metadata = await this.extractMetadata(filePath);

            const audioPath = `/audio/${category}/${file}`;
            const audioData = {
              path: audioPath,
              name: this.formatFileName(basename(file, ext)),
              category,
              duration: metadata.duration || null,
              format: ext.substring(1), // Remove the dot
              file_size: stats.size,
            };

            db.insertAudioFile(audioData);
            scannedPaths.add(audioPath);
            totalFiles++;
            console.log(`  ✓ ${category}/${file}`);
          } catch (err) {
            console.error(`  ✗ Failed to process ${category}/${file}:`, err.message);
          }
        }
      } catch (err) {
        console.warn(`  ⚠ Category folder not found: ${category}`);
      }
    }

    // Remove files from database that no longer exist on filesystem
    const existingFiles = db.getAllAudioFiles();
    let deletedCount = 0;
    for (const file of existingFiles) {
      if (!scannedPaths.has(file.path)) {
        db.deleteAudioFileByPath(file.path);
        deletedCount++;
        console.log(`  🗑 Removed: ${file.path}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✓ Scan complete: ${totalFiles} files indexed, ${deletedCount} removed in ${duration}ms`);

    return { totalFiles, deletedCount, duration };
  }

  async extractMetadata(filePath) {
    try {
      const metadata = await parseFile(filePath, { duration: true });
      return {
        duration: metadata.format.duration,
        bitrate: metadata.format.bitrate,
        sampleRate: metadata.format.sampleRate,
      };
    } catch (err) {
      console.warn(`Could not extract metadata from ${filePath}:`, err.message);
      return {};
    }
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
