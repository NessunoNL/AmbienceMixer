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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (environment_id) REFERENCES audio_files(id) ON DELETE SET NULL,
  FOREIGN KEY (weather_id) REFERENCES audio_files(id) ON DELETE SET NULL,
  FOREIGN KEY (music_id) REFERENCES audio_files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_scenes_label ON scenes(label);
