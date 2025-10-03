# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AmbientMixer is a mobile-first web app for Dungeon Masters to control music and ambient sounds during tabletop RPG sessions. The MVP focuses on client-side audio mixing with mock data. Backend integration (NAS/SMB, Docker, file management) is planned for future phases.

## Development Commands

### Frontend (Vite + React + TypeScript)

```bash
cd frontend
npm install          # Install dependencies
npm run dev         # Start dev server (http://localhost:5173)
npm run build       # Build for production (type check + build)
npm run lint        # Run ESLint
npm run preview     # Preview production build
```

## Architecture

### Audio System

**AudioEngine** (`frontend/src/audioEngine.ts`) is the core audio processing layer using Web Audio API:

- **Layer Management**: Three independent looping layers (environment, weather, music)
- **Crossfading**:
  - Scene changes: 1000ms crossfade
  - Mute/unmute: 300ms fade
  - Volume adjustments: 50ms fade
- **One-Shot Ducking**: Music layer automatically ducks to 30% volume when one-shots play, restoring after playback
- **Race Condition Prevention**: When loading new layers, existing layers are stopped immediately without fade (`stopLayer(type, false)`) to prevent setTimeout cleanup from deleting newly loaded layers

### State Management

**App.tsx** coordinates all application state:

- `volumes`: Current volume levels (0-100) for each layer
- `muted`: Mute state for each layer
- `audioInitialized`: Tracks whether Web Audio API context is ready (requires user interaction)
- `sceneId`: Currently selected scene

**Critical state interactions**:
- When loading scenes while muted, layers load at volume 0 to prevent audio flash
- Skip crossfade in `AudioEngine.loadLayer()` when `volume === 0` to avoid brief audio spikes
- Mute/unmute uses crossfades instead of instant cuts for smooth transitions

### Component Structure

```
App.tsx (main coordinator)
├── Section (card-style container)
├── SceneChip (scene selector buttons)
├── VerticalFader (volume control with mute)
│   └── Separates thin visual bar from wider clickable area for better UX
├── LayerTile (layer display - picker UI not yet implemented)
└── OneShotButton (trigger sound effects)
```

**VerticalFader** implementation details:
- Uses `trackRef` for accurate drag calculations (not container ref)
- Supports mouse drag, click-to-set, and scroll wheel control
- Visual bar (1.5px width) overlays wider clickable area (40px) for improved usability

### TypeScript Configuration

The project uses **strict mode** with `verbatimModuleSyntax: true` in `tsconfig.app.json`:

- **Type-only imports MUST use `import type`**:
  ```typescript
  import type { LayerType, Scene } from "./types";  // Correct
  import { LayerType } from "./types";               // Will fail
  ```
- Component prop types use `React.ComponentType<{ className?: string }>` for Lucide icons (not `LucideIcon`, which isn't exported)

### Theme System

`frontend/src/theme.ts` centralizes Everforest-inspired colors:
- `bg`, `bgSoft`, `card`: Background layers
- `text`, `textMuted`: Text colors
- `primary` (#A7C080): Green accent
- `accent` (#E6B450): Yellow/gold accent

Range slider thumb color (#A7C080) is hardcoded in `index.css` for cross-browser compatibility.

### Mock Data

`frontend/src/mockData.ts` provides test scenes with placeholder audio from Mixkit. Each scene includes:
- Environment/Weather/Music layers (optional)
- Context-aware one-shots
- Icon associations

## Common Patterns

### Audio State Synchronization

When modifying audio behavior, ensure consistency between React state and Web Audio API:

```typescript
// Example: Loading scene while respecting mute state
if (scene.environment) {
  await audioEngineRef.current.loadLayer(
    "environment",
    scene.environment.url,
    muted.environment ? 0 : volumes.environment / 100
  );
}
```

### Smooth Transitions

All volume changes should include fade durations to prevent jarring audio:

```typescript
audioEngine.setVolume(layer, targetVolume, fadeDuration);
```

Choose appropriate fade times:
- Scene crossfades: 1000ms
- Mute/unmute: 300ms
- Volume slider adjustments: 50ms (default)

## Known Constraints

- **Tailwind CSS v3**: Project uses v3 (not v4) due to PostCSS compatibility issues
- **Audio initialization**: Web Audio API requires user interaction; app shows "Click anywhere to start audio" until initialized
- **No backend**: Currently uses mock data; backend integration (file serving, scene persistence, library management) is planned for Phase 2
