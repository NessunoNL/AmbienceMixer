# AmbienceMixer working instructions

Personal DM audio application. Prefer a simple local preview and manual Git deployment; no staging infrastructure or mandatory PR workflow.

## Commands
- `./scripts/dev`: install pinned project-local Node 22 and lockfile dependencies if needed, then start the local backend and Vite preview at http://127.0.0.1:5174. Ctrl+C stops both.
- `./scripts/check`: production frontend build and backend JavaScript syntax checks.
- `./scripts/deploy`: checks a clean, pushed master, then deploys that commit over SSH. Run only when the user asks to publish. It changes the live service.
- Local database and audio: `.local/data/` and `.local/audio/{environment,weather,music,oneshots}/`. Never commit these, production data, or credentials.

## Architecture
React 19 + TypeScript + Vite + Tailwind 3 frontend; Express + better-sqlite3 backend. Audio plays in the browser through Web Audio and media elements. Server scans flat category folders and streams files. Scenes and music tags persist in SQLite. `App.tsx` coordinates state; `audioEngine.ts` handles playback. Production remains Docker on jacco@192.168.2.5 at /opt/docker/AmbienceMixer, serving NAS audio read-only.

## Working style
Keep changes focused and reviewable. UI redesign does not imply a framework rewrite. Preserve queued transitions and existing scenes. Verify browser behavior for audio/UI work; builds alone do not prove audible playback. Use appropriate targeted tests for logic changes. Keep actual implementation and documentation aligned.

## Known baseline issues to revisit
Tasks 3–4 replace those baseline engine paths: single-track looping, stable music volume, preloaded replacements, master-bus mute and independent mood queues with ahead-of-end advancement have automated coverage and desktop browser smoke checks. Audible smoothness and physical tablet verification remain pending. One-shot ducking is deferred. Task 5 integrates the scene editor, prepared scene/mood UI, Library and wake-lock control. Task 6 remains for integrated regression, listening and actual tablet verification. See IMPLEMENTATION_PLAN.md for the current handoff and unverified device checks.
