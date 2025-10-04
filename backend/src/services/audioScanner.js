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

    // Clear existing entries
    db.deleteAllAudioFiles();

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

            const audioData = {
              path: `/audio/${category}/${file}`,
              name: this.formatFileName(basename(file, ext)),
              category,
              duration: metadata.duration || null,
              format: ext.substring(1), // Remove the dot
              file_size: stats.size,
            };

            db.insertAudioFile(audioData);
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

    const duration = Date.now() - startTime;
    console.log(`✓ Scan complete: ${totalFiles} files indexed in ${duration}ms`);

    return { totalFiles, duration };
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
      library[file.category].push({
        id: file.id,
        name: file.name,
        url: file.path, // Frontend will use this to construct the stream URL
        duration: file.duration,
        format: file.format,
        volume: 0.7, // Default volume
      });
    }

    return library;
  }
}

export default new AudioScanner();
