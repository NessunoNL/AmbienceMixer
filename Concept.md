## Product Description – **AmbientMixer**

**Overview:**
A mobile-first and tablet-friendly web app that lets a Dungeon Master control music and ambient sounds to enhance tabletop RPG sessions. The app runs on a self-hosted backend (Node/Express in Docker, served from Ubuntu), indexing audio files from a mounted SMB share (NAS storage). It focuses on simplicity, quick access, and immersion.

**Core Features:**

1. **Three Sound Layers (Mixer):**

   * **Environment** (forest, dungeon, city, coast, etc.)
   * **Weather** (rain, wind, thunder, storm, etc.)
   * **Music** (battle, mysterious, poignant, calm, etc.)
     Each has a vertical fader for live mixing, plus mute/solo options. Sliders are central to the UI.

2. **Scenes:**

   * Preset combinations of Environment + Weather + Music.
   * Scenes can be created, saved, and recalled quickly.
   * When a scene is selected, the app applies crossfades and updates the **context-aware One-Shots** list.

3. **One-Shots (Scene-Aware):**

   * Triggerable short sound effects (door slam, ghoul hiss, thunderclap, etc.).
   * The available One-Shots change depending on the last selected scene.
   * Playing a One-Shot temporarily ducks the music (auto-fade down/up).

4. **Layer Tiles:**

   * Below the faders, three large tiles represent Environment, Weather, and Music.
   * Initially empty or showing an icon.
   * When tapped, they open a selection screen/modal where the DM chooses a new sound.
   * After selection, the tile shows a thumbnail/icon and label.
   * Tapping again crossfades or swaps the currently playing sound with the new one.

5. **Backend Architecture:**

   * Node/Express backend running in Docker.
   * Mounts an SMB share from NAS for the audio library.
   * Indexes sounds (by folder structure + optional metadata files) into a small DB (SQLite or MeiliSearch for search).
   * Serves metadata and streams files to the frontend.
   * Websocket/REST API for live control, scene saving, etc.

6. **Frontend Architecture:**

   * PWA (React + Tailwind, styled with Everforest-inspired calming fantasy palette).
   * Runs entirely in the browser; leverages the Web Audio API for low-latency mixing, volume control, crossfades, and FX.
   * UI design: Scenes row at the top, large vertical faders in the middle, layer tiles below, and One-Shots always visible.

7. **Styling:**

   * Everforest-inspired theme: muted greens, soft yellows, earthy browns, coral accents.
   * Rounded corners, subtle shadows, modern clean layout.
   * Calming and immersive, fits a fantasy RPG vibe.

**Additional Notes:**

* Scenes + context-aware One-Shots are the unique selling point.
* Simple, modern, slick, and calming interface—optimized for quick in-game use (few taps to switch atmosphere).
* Designed to be hosted on an ubuntu server by the DM using docker-compose, not subscription-based.

# User stories

### Core Mixer

* **As a DM**, I want to control **three independent sound layers (Environment, Weather, Music)** so that I can balance the atmosphere during a session.
* **As a DM**, I want each layer to have a **vertical volume fader** with mute/solo buttons so I can quickly adjust or isolate sounds.
* **As a DM**, I want volume changes to apply smoothly (crossfade/transition) so that adjustments don’t feel jarring.

### Scenes (Presets)

* **As a DM**, I want to **create a Scene** (combination of Environment, Weather, Music) so I can recall it later with one tap.
* **As a DM**, I want to **save, edit, and delete Scenes** so my library of presets matches my campaign.
* **As a DM**, I want to **switch to a Scene instantly** and have sounds crossfade seamlessly.
* **As a DM**, I want Scenes to **update the One-Shot list** automatically, so sound effects fit the current setting.

### One-Shots (Scene-Aware Effects)

* **As a DM**, I want to trigger **short sound effects** (e.g. door slam, thunderclap, ghoul hiss) during play.
* **As a DM**, I want One-Shots to **temporarily duck the Music layer** so the effect is clearly audible.
* **As a DM**, I want One-Shots to be **contextual to the last selected Scene**, so they’re always thematically appropriate.

### Layer Tiles (Sound Selection)

* **As a DM**, I want to see **large tiles for Environment, Weather, and Music** that show the current sound or “empty.”
* **As a DM**, I want to **tap a tile to open a picker** (modal or screen) where I can select a new sound.
* **As a DM**, I want the **tile to update with a thumbnail/icon and name** once a sound is chosen.
* **As a DM**, I want **tapping a tile again** to crossfade into the new sound smoothly.


### UX & Visuals

* **As a DM**, I want the app styled with a **calming Everforest-inspired theme** (muted greens, earthy tones, soft yellows) so it feels immersive and modern.
* **As a DM**, I want the **Scenes row at the top, vertical faders in the middle, tiles below, and One-Shots at the bottom** so the layout is quick and intuitive.
* **As a DM**, I want the interface to use **rounded corners, subtle shadows, smooth transitions** so it feels polished and professional.

### System Features

* **As a DM**, I want the app to run as a **self-hosted Docker container** on my Ubuntu server so I can keep it private and subscription-free.
* **As a DM**, I want the frontend to be a **PWA (Progressive Web App)** so I can install it on my tablet/phone.
* **As a DM**, I want **all mixing done client-side via Web Audio API** for low latency.
* **As a DM**, I want to manage **Scenes and settings saved persistently** (local DB or JSON config) so they survive restarts.

Got it ✅ — let’s add **sound file upload & metadata management** to the backlog. This is a big feature because it makes the app a full “library manager,” not just a player. Here’s how it slots in:

### Library Management & Uploads

* **As a DM**, I want to **upload new sound files directly through the app**, so I don’t have to manually place them on the NAS.
* **As a DM**, I want the app to **save uploaded files to the SMB share** automatically in the correct folder, so everything stays organized.
* **As a DM**, I want to **specify metadata and categories** (e.g. Environment, Weather, Music, tags like “Dungeon” or “Battle”) during upload so that the sound is indexed properly.
* **As a DM**, I want the backend to **store metadata in the DB** (linked to the file path) so the app can search, sort, and filter sounds reliably.
* **As a DM**, I want the option to **edit or delete metadata** after upload (e.g. re-tagging a track from “Music” to “Environment”).
* **As a DM**, I want the app to **validate audio file formats** (e.g. accept .ogg, .mp3, .wav) and reject unsupported ones gracefully.
* **As a DM**, I want the app to **auto-generate a waveform preview or duration info** when uploading, so I see what I’m working with.
* **As a DM**, I want uploads to **support drag-and-drop** and batch mode for convenience.


