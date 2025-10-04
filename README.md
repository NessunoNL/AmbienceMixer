# AmbientMixer

A mobile-first web application for Dungeon Masters to control music and ambient sounds during tabletop RPG sessions. Features a 3-layer audio mixer (Environment, Weather, Music) with smooth crossfades, scene presets, and context-aware one-shot sound effects.

## Features

- **3-Layer Mixer**: Independent control of Environment, Weather, and Music layers
- **Scene Management**: Create, edit, and delete custom scene presets
- **One-Shot Effects**: Trigger context-aware sound effects with automatic music ducking
- **Smooth Crossfades**: All audio transitions fade smoothly (1000ms for scenes, 300ms for mute)
- **Persistent Storage**: Scenes and preferences saved to SQLite database
- **Audio Streaming**: HTTP range request support for seeking in audio files
- **Mobile-First**: Optimized for tablets and phones with Everforest-inspired theme

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite build tool
- Tailwind CSS v3
- Web Audio API
- Lucide icons

**Backend:**
- Node.js 20 + Express
- SQLite3 (better-sqlite3)
- music-metadata for audio file parsing
- Docker + Docker Compose

## Prerequisites

- Docker and Docker Compose installed
- SMB/CIFS share mounted at `/mnt/ambience` on the host system
- Nginx Proxy Manager (or similar reverse proxy) on `frontend` Docker network

## Directory Structure

```
AmbienceMixer/
├── frontend/          # React application
├── backend/           # Express API server
│   ├── src/
│   │   ├── routes/    # API endpoints
│   │   ├── services/  # Audio scanner, database
│   │   └── db/        # SQLite schema
│   └── public/        # Built frontend (generated)
├── data/              # SQLite database (Docker volume)
└── docker-compose.yml
```

## Audio Library Setup

### 1. Create SMB Share

On your Proxmox Cockpit LXC container (192.168.2.3), create an SMB share named `ambience`.

### 2. Mount SMB Share on Ubuntu Host

Add to `/etc/fstab`:

```bash
//192.168.2.3/ambience /mnt/ambience cifs credentials=/etc/smb-credentials/ambience,vers=3.1.1,sec=ntlmssp,uid=1000,gid=1000,noperm,cache=none,noserverino,actimeo=0,_netdev,x-systemd.automount,x-systemd.idle-timeout=60 0 0
```

Create credentials file `/etc/smb-credentials/ambience`:

```
username=your_smb_username
password=your_smb_password
```

Set permissions:

```bash
sudo chmod 600 /etc/smb-credentials/ambience
sudo mkdir -p /mnt/ambience
sudo mount -a
```

### 3. Create Audio Folder Structure

On the SMB share, create these folders:

```
/mnt/ambience/
├── environment/   # Forest, dungeon, cave, tavern, etc.
├── weather/       # Rain, wind, thunder, etc.
├── music/         # Battle, calm, mysterious, etc.
└── oneshots/      # Door slams, footsteps, spell effects, etc.
```

### 4. Upload Audio Files

Upload MP3 or WAV files into the appropriate folders. The backend will:
- Auto-scan on startup
- Extract metadata (duration, bitrate)
- Auto-detect category from folder name
- Format filenames nicely (e.g., "forest-ambient.mp3" → "Forest Ambient")

## Deployment

### 1. Clone Repository

```bash
cd /path/to/projects
git clone https://github.com/NessunoNL/AmbienceMixer.git
cd AmbienceMixer
```

### 2. Build and Start

```bash
docker compose up -d --build
```

This will:
- Build the frontend (Vite)
- Copy frontend build to backend/public
- Install backend dependencies
- Start the Express server
- Scan `/mnt/ambience` and index audio files
- Create SQLite database at `/path/to/AmbienceMixer/data/ambience.db`

### 3. Configure Nginx Proxy Manager

In NPM, create a new Proxy Host:

- **Domain Names**: `ambience.brouwerhomelab.nl`
- **Scheme**: `http`
- **Forward Hostname / IP**: `ambience-mixer` (Docker container name)
- **Forward Port**: `3000`
- **SSL**: Request Let's Encrypt certificate
- **Websockets Support**: ON (for future features)

The container is on the `frontend` network (shared with NPM), so no port binding is needed.

### 4. Access the App

Navigate to `https://ambience.brouwerhomelab.nl` and click anywhere to initialize audio.

## Development

### Frontend Development

```bash
cd frontend
npm install
npm run dev  # Starts dev server on http://localhost:5174
```

API requests to `/api/*` are proxied to `http://localhost:3000` (start backend separately).

### Backend Development

```bash
cd backend
npm install
npm run dev  # Starts with --watch flag
```

Requires `/mnt/ambience` mount or set `AUDIO_DIR=/path/to/local/audio/folder`.

### Manual Audio Rescan

Trigger a rescan via API:

```bash
curl -X POST https://ambience.brouwerhomelab.nl/api/audio/scan
```

## API Endpoints

- `GET /api/audio/library` - Get all audio files grouped by category
- `GET /api/audio/:id/stream` - Stream audio file (with range support)
- `POST /api/audio/scan` - Manually trigger filesystem rescan
- `GET /api/scenes` - List all scenes
- `POST /api/scenes` - Create new scene
- `PUT /api/scenes/:id` - Update scene
- `DELETE /api/scenes/:id` - Delete scene

## Troubleshooting

### No audio files showing up

1. Check SMB mount: `ls /mnt/ambience`
2. Check Docker volume binding: `docker exec ambience-mixer ls /app/audio`
3. Check backend logs: `docker logs ambience-mixer`
4. Trigger manual rescan: `POST /api/audio/scan`

### Database errors

Database is stored in `./data/ambience.db`. To reset:

```bash
docker compose down
rm -rf data/
docker compose up -d
```

### Frontend not loading

Check that frontend built correctly:

```bash
docker exec ambience-mixer ls /app/public
```

Should show `index.html`, `assets/`, etc.

## License

MIT

## Credits

Built with [Claude Code](https://claude.com/claude-code)
