-- Audio files table
CREATE TABLE IF NOT EXISTS audio_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('environment', 'weather', 'music', 'oneshots')),
  duration REAL,
  format TEXT NOT NULL,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audio_category ON audio_files(category);
CREATE INDEX IF NOT EXISTS idx_audio_name ON audio_files(name);

-- Scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  environment_id INTEGER,
  weather_id INTEGER,
  music_id INTEGER,
  oneshots TEXT, -- JSON array of oneshot IDs
  environment_volume INTEGER DEFAULT 70,
  weather_volume INTEGER DEFAULT 45,
  music_volume INTEGER DEFAULT 60,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (environment_id) REFERENCES audio_files(id) ON DELETE SET NULL,
  FOREIGN KEY (weather_id) REFERENCES audio_files(id) ON DELETE SET NULL,
  FOREIGN KEY (music_id) REFERENCES audio_files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scenes_label ON scenes(label);

-- Music tags table
CREATE TABLE IF NOT EXISTS music_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT, -- Optional hex color for UI
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship between music files and tags
CREATE TABLE IF NOT EXISTS audio_file_tags (
  audio_file_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audio_file_id, tag_id),
  FOREIGN KEY (audio_file_id) REFERENCES audio_files(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES music_tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_file_tags_audio ON audio_file_tags(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_audio_file_tags_tag ON audio_file_tags(tag_id);

-- Add music playback mode to scenes (single-loop or tag-shuffle)
ALTER TABLE scenes ADD COLUMN music_mode TEXT DEFAULT 'single-loop' CHECK(music_mode IN ('single-loop', 'tag-shuffle'));
ALTER TABLE scenes ADD COLUMN music_tag_id INTEGER REFERENCES music_tags(id) ON DELETE SET NULL;
