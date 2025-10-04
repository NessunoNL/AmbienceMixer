import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import audioRouter from './routes/audio.js';
import scenesRouter from './routes/scenes.js';
import audioScanner from './services/audioScanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api/audio', audioRouter);
app.use('/api/scenes', scenesRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV });
});

// Serve frontend static files in production
if (NODE_ENV === 'production') {
  const publicPath = join(__dirname, '../public');
  app.use(express.static(publicPath));

  // Serve index.html for all non-API routes (SPA support)
  app.get('*', (req, res) => {
    res.sendFile(join(publicPath, 'index.html'));
  });
}

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 AmbientMixer backend running on port ${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);

  // Scan audio directory on startup
  try {
    await audioScanner.scanDirectory();
  } catch (err) {
    console.error('Failed to scan audio directory on startup:', err);
  }
});
