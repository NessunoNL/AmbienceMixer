# Scene-and-mood mixer: task handoffs

## How to continue

Run the tasks below sequentially in separate Codex conversations in this project. Each task should read AGENTS.md, DEVELOPMENT.md and this file, inspect the current code, then implement only its stage. Do not start dependent tasks concurrently or in isolated worktrees without bringing preceding changes across.

After each stage, update its status and the handoff log below with changed files, checks actually performed, unresolved issues and the next concrete action. If interrupted, record partial progress here. Never treat a build as listening or touch-device verification. The user explicitly authorized homelab deployment for testing on 2026-11-04. Use the existing SQLite backup and rollback-image deployment workflow.

Starting prompt for any new conversation:

> Read AGENTS.md, DEVELOPMENT.md and IMPLEMENTATION_PLAN.md. Implement the first incomplete task whose dependencies are complete. Preserve unrelated changes. Update the handoff log with evidence and remaining work before finishing. Use the approved mockup as the implementation reference. Homelab testing is authorized; retain deployment backups.

## Build on the working application

This is an incremental redesign of an existing working project. Every task must inspect and reuse the current components, APIs, storage and playback behavior before introducing replacements. Extend existing functionality wherever practical; replace code only where the agreed behavior requires it.

Keep the application runnable and its existing user flows working between stages. Introduce compatible storage/API changes before switching consumers, and remove superseded paths only after their replacements are integrated and verified. Preserve existing scenes, audio files, music assignments and unrelated local changes. The approved mockup defines the interface layout and visual styling; its demo data and simplified playback behavior must not replace real application functionality.

For each task, verify the affected existing behavior as well as the new behavior, and record any remaining regression or compatibility concern in the handoff log. Do not defer all regression checking to task 6.

## Status

| Task | Dependency | Status |
| --- | --- | --- |
| 1. Scene storage and migration | None | Complete |
| 2. Sound category management and safe scanning | 1 | Complete |
| 3. Multi-ambience playback engine | 1 | Implementation complete; listening/tablet checks pending |
| 4. Independent mood queue | 3 | Implementation complete; listening/tablet checks pending |
| 5. Scene editor and tablet controls | 1–4 | Implementation complete; listening/tablet checks pending |
| 6. Integrated verification and documentation | 1–5 | In progress; automated checks pass, browser/device checks pending |

## Agreed product contract

- Primary device: Samsung Galaxy Tab S7 FE, normally kept on the mixer during sessions. Prioritize landscape touch use, readable text, generous touch targets and restrained, responsive motion; retain portrait support. Keep the current web stack. Uninterrupted background/locked-screen playback is not a release requirement for this workflow.
- Offer home-screen installation with a web app manifest, icons and standalone display, while preserving ordinary browser use. Offline audio is outside this scope. Offer an optional Keep screen awake control, off by default, with an accurate active/unavailable status and graceful fallback.
- Retain React/TypeScript/Vite/Tailwind, Express and SQLite. Use the approved interactive reference in `design/scene-and-mood-preview.html`; it contains invented demo sounds, not the actual library.
- Scenes contain one environment, ordered ambiences with individual volumes, and ordered one-shot selections. Music moods remain independent, including when opening legacy scenes.
- Each ambience also has a saved enabled flag, independent of volume and removal. Off ambiences remain in the scene with their volume remembered. On/off toggles prepare a change; Apply fades the sound in or out using the scene transition duration. New and migrated ambience entries default to enabled. Editing an off ambience's volume never starts playback.
- Give off ambience cards a muted grey background/fill while retaining readable text, saved volume and operable controls; do not disable or fade the entire card. Use a labeled, keyboard-accessible on/off toggle separate from Remove. Show Playing or Off from actual playback, with a separate Pending on/Pending off label when the active scene's prepared state differs. A different prepared scene shows its saved/draft On or Off state and a clear Prepared label, without implying it is playing. Colour alone must not convey state; an enabled sound at zero volume is not an off sound.
- Always prepare scene, environment, ambience membership and mood changes first. Provide Apply scene, Apply mood, Apply all and cancellation, preserving adjustable crossfade durations. Save persists without playing; Apply may play an unsaved draft without saving it.
- Separate saved data, per-scene session drafts, prepared changes and active playback. Clearly label active versus prepared scenes. Preserve drafts across selection changes; failed saves retain drafts. Provide create, rename, delete, Save and Revert.
- Volume, mute, pause, next-song and active-queue song selection act immediately. A draft volume affects live audio only for the active scene and matching sound; another prepared scene's volumes only set future levels.
- Keep the bottom one-shot trigger strip on the active scene until Apply. Edit prepared one-shots inside the scene editor. One-shot volume is a global preference; automatic ducking is deferred.
- Tablet landscape: scene left, music right; stack on narrower screens. Compact environment selector, then two-column ambience cards. Background fill and percentage show volume, without a visible slider. Horizontal drag adjusts volume, vertical gestures scroll; keyboard control remains available. Remove works in one tap.
- Ambience and one-shot pickers are searchable bottom sheets with category filters, scrollable results and pinned Done. Done closes without applying playback. Keep Library management and rescan in a secondary view.
- Preparing a mood leaves the active queue visible and playing. Apply creates a shuffled queue. Selecting a song advances immediately to it. Shuffle changes only upcoming songs. Repeat the catalogue after exhaustion, avoiding immediate repeats when alternatives exist.
- Loading the app never autoplays. Starting audio requires an explicit gesture. Master mute includes every sound, including one-shots and fading tails.
- Smoothness is a product requirement for every playback change except direct volume adjustments. “Immediate” controls begin their transition immediately; they must not hard-cut audio. Crossfade scene/mood changes, Next, manual song selection and automatic music advancement. Fade sounds entering or leaving, pause/resume, and mute/unmute. Keep volume gestures responsive, with only brief gain smoothing to prevent clicks.
- Use a shared transition policy: default 3-second overlapping equal-power crossfades for track replacements, adjustable through the transition controls; 200 ms fades for pause/resume and master mute/unmute. Pause media only after fading out and resume at zero gain before fading in. Preserve underlying channel levels while muted. One-shots retain their natural attack and decay; use only a minimal anti-click envelope where needed, rather than a long fade that obscures impacts.
- Preload upcoming music and begin automatic crossfades before the current track ends. Cap overlap for short tracks, avoid restarting unchanged loops, and make loop boundaries seamless through overlapping playback when the source is not already seamless. If a replacement is unavailable, keep the current sound playing where possible and report the failure; do not claim seamless playback when buffering or the source audio prevents it. Rapid actions must retarget fades from their current gain without jumps or orphaned audio.

## Task 1 — Scene storage and migration

Extend shared scene types and APIs with ordered ambience entries containing audio IDs, volumes and boolean enabled flags. Persist enabled in the scene-child table, defaulting to true for legacy entries and omitted flags from compatible callers. Validate explicit flag values as well as file references, their appropriate library categories and volume bounds. Use transactional scene writes. Keep environment/volume and ordered one-shot IDs.

Migrate each existing weather selection into the first ambience, preserving volume. Migration must run only once, including after a user removes all ambiences. Preserve scene IDs, environments and one-shots. Retain legacy music fields without applying them in the new player. Preserve omitted fields on partial updates.

Keep the existing frontend working during this stage; introduce compatible fields before replacing consumers. Test using a temporary copy/fixture of the old schema, repeated startup, round-trip saves, empty ambience lists, invalid references and transactional failures. Do not migrate production.

## Task 2 — Sound category management and safe scanning

Add database-backed category CRUD and assignment APIs. Each ambience or one-shot has one optional category. Deleting a category leaves sounds uncategorized. Expose assignments in library responses; preserve IDs and assignments during rescan. UI arrives in task 5.

Keep existing NAS directories: `weather` is labeled Ambiences in the UI. No file moves or mount changes. Failed directory reads or metadata parsing must not erase existing audio records and scene references. Test rescans with unchanged files, parsing failures, unavailable directories and category deletion.

## Task 3 — Multi-ambience playback engine

Replace the fixed weather playback slot with independently keyed ambience instances. Reuse shared sounds across scene changes without restarting. Fade removed sounds out and new sounds in. Preload replacement audio before fading existing audio; preserve playback on preparation failure. Guard against stale asynchronous operations and clean up media elements, listeners and timers.

Only enabled ambience entries belong in the audible mix. Applying Off fades out and releases its playback instance without deleting its scene entry or remembered volume. Applying On starts it at the remembered volume with a fade; it need not resume the old loop position. Cancelling a prepared toggle leaves playback unchanged. A pending Off retains live volume control until applied; an already-off entry's volume only edits its future level.

Expose scene playback operations and immediate volume/master controls through a focused controller rather than adding coordination to the large App component. Preserve legacy callers until the new UI is integrated. Master mute must include fading tails and one-shots. Start/resume only through a user gesture.

Test simultaneous ambience instances, shared-track reuse, removal, rapid replacement, failed loads, mute and cleanup. Document browser/listening checks separately from mocked engine tests.

Implement the shared transition policy above, including loop boundaries and pause/mute behavior. Keep master fades separate from channel gain so mute/unmute does not overwrite mix levels. Verify that overlapping sounds do not produce avoidable level jumps or clipping; reuse identical sources instead of crossfading a sound against itself.

Start actual-device verification in this stage on the Galaxy Tab S7 FE rather than waiting for task 6: record browser/version, confirm audio starts from a gesture, and exercise simultaneous sounds and crossfades. Record device checks as pending if the tablet is unavailable; desktop emulation is not equivalent. Use a separately configured development preview reachable from the tablet when needed, without changing production or exposing the preview by default.

## Task 4 — Independent mood queue

Next and manual selection must use the same preloaded crossfade path as mood changes. Schedule automatic advancement ahead of track end, not solely from the ended event; retain an ended-event fallback when duration is unavailable. Cancel obsolete preload/advance work on queue changes and ensure a transition advances the queue only once. Reshuffling upcoming tracks must not alter the current sound.

Reuse music tags and assignments as moods, retaining existing tag APIs. Extract queue state and playback coordination into a focused module. Expose current/upcoming songs, apply mood, select song, pause/resume, next and reshuffle upcoming. Do not interrupt playback while preparing another mood.

Keep volume stable on every transition. Repeat the mood catalogue without an immediate boundary repeat where alternatives exist. Bound failed-track retries so an entirely unplayable mood cannot loop indefinitely. Preserve current playback on failed mood preparation and reject stale requests. Test queue ordering, selection, repeat boundaries, pause, volume persistence and all-tracks-failed behavior.

## Task 5 — Scene editor and tablet controls

Integrate tasks 1–4 into the approved layout and product contract above. Extract scene/draft state, reusable picker, ambience volume card and music panel from App coordination. Wire real audio and API data, including category CRUD/assignment and existing mood management in Library.

Handle empty libraries/scenes/moods, missing audio, loading states and failed saves visibly. Keep prepared selection separate from the active snapshot and trigger strip. Cancellation must not accidentally save drafts or stop active playback. Wire individual and combined Apply operations with transition controls; disable duplicate submissions while preparing audio.

Add home-screen installation metadata and icons; document the target browser's installation flow without requiring an install prompt to be available. Do not introduce audio caching or offline promises. Implement Keep screen awake using feature detection: request a screen wake lock only while enabled and visible, release on disable/unmount, and reacquire on return to visibility when still enabled. Handle rejection/release without disrupting audio and distinguish the requested preference from an actually held lock. Verify secure-context and installation requirements during implementation; document any HTTPS prerequisite rather than silently changing hosting.

Verify Save versus Apply, draft switching, independent music, one-shot scene ownership, search/filter selection retention, keyboard volume, one-tap removal and large-library scrolling. Check responsive portrait/landscape layouts. Record actual touch testing as pending until done on a touch device.

Verify ambience On/Off persistence and legacy defaults, pending labels versus actual playback, cancel/revert, and fade-out/fade-in with the remembered volume. Check that toggles and Remove do not start a volume drag, off cards remain readable and editable, and changing an off card's volume never activates it. Include rapid toggles during transitions in playback tests.

## Task 6 — Integrated verification and documentation

Run targeted tests and `./scripts/check`. Exercise the app with real local audio: preparation stays silent, Apply crossfades, shared ambiences continue, music volume survives advancement, failures preserve playback, and master mute covers everything. Check migration against a copied old database without touching production.

Verify tablet layouts and actual touch dragging/scrolling. If the environment cannot verify audible output or physical touch behavior, explicitly record these as pending rather than claiming success. Update DEVELOPMENT.md and relevant existing documentation to match implemented behavior, including legacy scene migration and category management.

On the Galaxy Tab S7 FE, verify landscape and portrait touch use, home-screen standalone launch, and Keep screen awake including disable, visibility changes and unsupported/denied fallback. Run a foreground session of at least 30 minutes with multiple ambiences and music advancement; record the tested mix size, browser/version, audible stability and UI responsiveness. Briefly switching away and back must recover sensibly, without promising uninterrupted background audio.

Explicitly listen for clicks, silence gaps and abrupt level jumps during Next, manual selection, automatic advancement, scene/mood changes, loop boundaries, pause/resume and mute/unmute. Cover short tracks, rapid repeated commands, changes during a fade and delayed/failed loads. Confirm direct volume gestures stay responsive and one-shots retain their attack. Gain-scheduling tests support, but do not replace, these listening checks.

Leave publication to a separate user request using the existing backup/deployment workflow. No framework rewrite, dependency overhaul or automatic ducking in this project scope.

## Handoff log

### Initial handoff

- Implementation has not started. Prior work inspected scene storage, API, scanner and audio engine; the approved UI exists as a standalone mockup only.
- Existing uncommitted changes were present before implementation: `.gitignore`, `CLAUDE.md`, `README.md`, `backend/src/index.js`, `frontend/vite.config.ts`, plus `.dockerignore`, `.vscode/`, `AGENTS.md`, `DEVELOPMENT.md`, `design/` and `scripts/`. Preserve them.
- Known code findings to verify while implementing: scene API writes mix snake-case IDs with camel-case volumes; playlist advancement captures old volume; replacement playback currently fades before loading; scanner failure can remove records; music mode/tag fields are not consistently persisted by scene writes.
- No implementation tests, real-audio listening or touch-device verification have been performed for this redesign.
- Next action: task 1, inspect current schema/database service and scene routes, then implement compatible migration and API changes with targeted tests.

### Task 1 completed — 2026-11-03

- Added transactional, one-time `scene-ambiences-v1` migration and ordered `scene_ambiences` storage in `backend/src/services/database.js`, including enabled flags, preserved levels and old volume-column defaults. Explicitly enable foreign keys for cascade cleanup.
- Added payload validation/legacy compatibility in `backend/src/services/scenePayload.js`; scene routes now atomically save parent and ambience rows and hydrate ambience metadata. Partial updates preserve omitted one-shots and legacy fields. New ambience lists project their first enabled entry into the legacy weather slot; old weather edits affect only that slot and preserve other entries.
- Added `SceneWrite`, `SceneAmbienceInput` and hydrated `SceneAmbience` types; corrected frontend API write signatures without changing the current UI or audio engine. Scene.ambiences remains optional in frontend constructors during integration; API responses always include an array.
- Verification: temporary old-schema copy and real loopback HTTP tests passed (10 subtests plus parent, 11 reported tests). Covers repeat migration/reopen, older volume-column defaults, ordering, enabled defaults/all-disabled scenes, legacy saves, partial updates, validation, injected transaction failures and deletion cleanup. `./scripts/check` passed; only existing browser-data freshness warnings appeared. Test command and API contract are recorded in DEVELOPMENT.md.
- No production or existing local app database was migrated. No UI, listening or physical tablet checks claimed for this storage-only stage. The current UI still uses single weather playback and legacy scene music until tasks 3–5 integrate their replacements.
- Next action: task 2, sound category storage/APIs and failure-safe scanning. Inspect existing scanner behavior and preserve new scene ambience references when scan reads fail. Existing PWA build output was observed during checks: inspect and reuse that setup in task 5 instead of recreating it.

### Task 2 completed — 2026-11-03

- Added `sound_categories` and nullable `audio_files.sound_category_id` with SET NULL on category deletion. Idempotent startup migration preserves existing files and assignments. Shared named categories apply only to weather/one-shot files; folder names and music tags remain separate.
- Added category CRUD at `/api/sound-categories` and assignment at `PUT /api/audio/:id/sound-category`. Library entries expose category metadata. Frontend API methods/types are ready for Library integration; full endpoint/error contracts are documented in DEVELOPMENT.md.
- Scanner now collects metadata before a transactional commit, preserves old records/metadata on processing failures, skips pruning failed physical categories, and shares overlapping scan requests. Valid absent-file detection still removes records from successfully scanned categories. Results expose partial/warnings; a readable but unexpectedly empty mount is not distinguishable from intentional removal.
- Verification: all 19 reported backend tests passed (17 subtests plus two parent tests), including task 1 regressions and new real-WAV/category HTTP cases: CRUD, validation, assignments, repeated migration/rescans, unavailable folder, corrupt metadata/broken symlink, recovery, overlapping requests, rollback of changed metadata after an injected write failure, and category deletion without scene loss. `./scripts/check` passed with existing browser-data freshness warnings; `git diff --check` passed.
- Files: extended database/scanner/audio routing and frontend API client, added `backend/src/routes/soundCategories.js` and `backend/test/soundCategories.test.js`; preserved prior local server binding changes in index.js. No production/local app data touched; temporary fixtures only. No UI or audible playback changes/claims.
- Next action: task 3, multi-ambience playback engine. For task 5, reuse the new client methods and show partial scan warnings; category management controls are not implemented yet.

### Task 3 implementation — 2026-11-03 (device validation pending)

- Added `frontend/src/audio/{transitions,streamMixer,scenePlayback}.ts`. Shared stream mixer handles independently keyed ambience voices, atomic preparation of scene batches, unchanged-source reuse, disabled entries, bounded load timeout, supersession/cancellation, fade scheduling, master mute, pause and cleanup. ScenePlaybackController owns applied scene snapshots without applying music or saving drafts.
- Replaced duplicate AudioEngine stream handling with a compatibility facade. Existing layer/playlist callers remain supported; single-track loops now loop, manual Next crossfades, playlist volume stays current, and load failures no longer recursively retry. Full mood queues and automatic music overlap remain task 4.
- Loop boundaries preload a standby element and overlap with linear gains for identical-source material; native loop fallback and surfaced errors remain for failed preparations. Defaults: replacement 3 s equal-power, pause/master 200 ms, volume anti-click 20 ms, one-shot entry 5 ms, load timeout 15 s. Rapid return to a fading identical stream reuses it and cancels its cleanup.
- Current App now has explicit Start audio instead of click-anywhere startup, awaits one-shot startup, uses true master mute, reports engine errors, and disposes the engine on unmount. Existing scene UI stays on its legacy selection flow; task 5 must use the new scene controller for prepared multi-ambience scenes.
- Added 13 simulated playback tests covering startup gating, multiple/shared/disabled streams, atomic loads/failure preservation, supersession/cancellation/disposal, off/on levels, master routing including tails/shots, pause races, loop overlap, interrupted gain curves, legacy playlist volume/failure, rapid off/on source reuse, bounded one-shots, and live level changes during loading. All pass; `./scripts/check` passes with existing browser-data freshness warnings. New dev-only `frontend/audio-check.html` and `src/audioCheck.ts` provide manual real-library controls without saving scenes.
- Browser verification could not run: CUA inventory returned no browsers and opening IAB failed with “Browser is not available: iab”. No browser/listening or Samsung tablet verification claimed. Manual checks at `/audio-check.html` and the main UI remain required, including overlap audibility, buffering failures and foreground stability. See DEVELOPMENT.md for instructions. No production deployment or service/data changes were made.
- Task 4 may build on the completed software interface while the device checks remain pending; carry those checks forward to task 6 rather than treating them as passed. Next implementation action: independent mood queue, reuse the mixer replacement path, add ahead-of-end music preparation and queue lifecycle tests. Preserve unrelated files, including the newly observed untracked `.aws` entry (not inspected or modified).

### Task 4 implementation — 2026-11-03 (listening/tablet checks pending)

- Added MusicQueueController in `frontend/src/audio/musicQueue.ts`: prepared versus active moods, snapshot/subscription API, current/upcoming queue, direct selection, Next, pause, independent volume, upcoming reshuffle, catalogue repeat without avoidable adjacent repeats, bounded failed-track retries and stale-operation guards. Existing tag APIs supply mood tracks; no backend/schema changes.
- Extended StreamMixer with cancellable paused preloads consumed by the existing replacement path, restart support for one-song repetition, and short-music fade caps. Automatic advancement preloads and starts before the end; unknown durations use an ended fallback. Pause works before the first music channel exists. AudioEngine's legacy playlist methods now delegate to this controller, and App uses real tag/audio IDs plus guarded fetches and selected transition duration.
- Browser access became available during this stage. Real MP3 playback initially failed for detached media in the embedded browser; keeping hidden media elements attached fixed it. Cleanup removes them. Added coverage for attachment/disposal alongside queue lifecycle cases. Updated development audio-check page with music preparation, Apply/Cancel, song selection, pause, shuffle and near-end seek.
- Verification: all 23 simulated frontend tests passed, including task 3 regressions. `./scripts/check` and `git diff --check` passed (existing browser-data warnings only). Codex IAB desktop checks with real local MP3s verified preparation without playback, successful Apply, cancellation, overlapping playing media during Next, pause/resume, automatic next-song advancement before/at the boundary after near-end seek, independent environment/ambience playback, ambience-off removal, one-shot invocation and disposal. Also verified existing UI Start audio and queued weather selection/Apply. Media elements reached readyState 4 and advanced currentTime; this is not listening evidence.
- Checks used a temporary SQLite copy under `/tmp/ambience-task4-preview-*`, preserving original local scenes/database. Preview processes and the test tab were closed afterward. Existing user mockup tab was left untouched. No deployment or production changes.
- Remaining verification: audible transition/loop quality, real multi-ambience stress on the Galaxy Tab S7 FE and its 30-minute foreground session. The local library contained one ambience, so simultaneous distinct ambience playback is currently simulated-test coverage; the browser check exercised environment plus ambience plus music.
- Next action: task 5, scene editor/tablet controls. Use `engine.scenes` and `engine.music` rather than duplicating their playback state. Subscribe to music snapshots and display active versus prepared state/errors; keep music independent when the new scene UI replaces the legacy scene-loading path. Carry pending listening/device checks into task 6. Task 5 may proceed on the completed software interfaces.


### Task 5 implementation — 2026-11-03 (listening/tablet checks pending)

- Replaced the legacy App layout with scene/music columns and an active-scene one-shot dock. Added focused `frontend/src/mixer/` modules for session drafts, API/playback coordination, scene/music/Library panels, accessible volume cards, modal sound pickers and wake lock. Existing React stack, engine controllers, scene/tag/category APIs and music assignment manager are reused.
- Scene creation/naming/deletion, Save/Revert, per-scene drafts, cancellation, Apply scene/mood/all and independent live controls are integrated. Writes omit legacy music fields. Drafts survive scene switching/cancellation and failed saves; applying never saves. Active snapshot and one-shot strip change only after scene Apply. Apply all commits scene/music independently and reports partial failure explicitly.
- Ambiences use two columns, background volume fill/percentage, horizontal drag with vertical pan allowed, keyboard slider roles and separate toggle/remove targets. Grey Off cards retain editable volume; Playing/Off and pending changes are labeled. Pickers retain selections across search/category filters, scroll internally and pin Done without applying audio.
- Library exposes rescan warnings, category CRUD/assignment and existing mood tag management, now with a native focus-trapping dialog and accessible Close. Added mood rename using existing API. Kept PWA setup, replaced starter icon manifest entries with generated app PNG icons, preserved zoom and added optional wake-lock state/lifecycle handling. HTTPS/installation constraints documented without hosting changes.
- Verification: 23 playback tests plus four new draft/payload tests pass; build/backend syntax and diff-whitespace checks pass. Desktop IAB used temporary DB/audio fixtures: real local MP3s plus generated WAVs (61 ambiences total). Verified Save silent/Apply audible-media activation, shared stream time continuity, draft switching/cancel, one-tap removal, keyboard volume, pending/off behavior, active one-shot ownership, category create/assign, mood create/bulk assign, music Next overlap, scrolling picker/filter retention, injected save failure/retry, missing-file failure preserving active audio, wake-lock Active response and reload without autoplay. Checked landscape 1280×800, portrait 800×1280 stacking/no horizontal overflow, and 390×844 picker layout/focus/pinned Done.
- Limitations: browser media state is not listening evidence. Physical touch/scroll arbitration, audible transition quality, standalone installation, full wake-lock lifecycle, long-session stability and category rename/delete/scene-delete UI regressions remain task 6. Temporary preview servers and test tab closed; original user mockup tab preserved; browser viewport reset. No production deployment or original local library/database modifications.
- Next action: task 6, integrated verification. Read this handoff and DEVELOPMENT.md, run targeted frontend/backend tests/checks, complete remaining desktop regressions and arrange explicit Galaxy Tab testing without exposing preview or deploying automatically. Keep actual touch/listening checks pending until verified.


### Task 6 local verification — 2026-11-04 (incomplete)

- Resumed after usage interruption. The screen-awake fix from the preceding turn is present in `frontend/src/mixer/wakeLockSession.ts`, with the React hook delegating lifecycle handling to it. A hidden page detaches the old lock before awaiting release, preventing a quick return from losing its replacement or incorrectly clearing Active status. Late acquisitions after hide/unmount are released; rejection/system release do not create retry loops.
- Added four lifecycle regression tests in `frontend/test/wakeLock.test.mjs`. Re-ran 23 playback, four draft/payload, four wake-lock tests and 19 backend tests: all passed. `./scripts/check` and `git diff --check` passed; only existing browser-data freshness warnings appeared. No production or original local database/library changes.
- Browser checks remain incomplete. The preceding attempt reached Apply all and Library but timed out around the native category rename prompt; do not infer that rename or deletion succeeded. On this resumed turn, browser inventory was empty and creating IAB returned unavailable. No new browser verification is claimed for the wake-lock fix. No test preview server was started in this resumed turn.
- Added VERIFICATION.md with evidence, remaining desktop regressions and a focused Samsung tablet/listening checklist. A reachable tablet development preview still needs to be arranged separately; localhost on the desktop is not reachable from the tablet. Do not expose or deploy automatically.
- Next action: restore browser availability and finish category rename/delete, active-scene deletion, Apply all/partial-failure and wake-lock browser checks. Then complete physical Galaxy Tab touch, installation, listening and 30-minute foreground checks with the user. Keep task 6 incomplete until these are recorded.

### Tablet preview prepared — 2026-11-04

- User agreed to continue with browser/tablet verification. Browser automation now fails during runtime startup (sandbox workspace-path error); no additional browser/UI results are claimed.
- Prepared a temporary LAN preview at `http://192.168.2.60:5174`, serving the built frontend through Express bound specifically to the desktop's LAN address. Production is untouched. No firewall or hosting changes. HTTP preview is for audio/touch checks; installation and wake-lock secure-context checks remain pending.
- Disposable database: `/tmp/ambience-tablet-preview-bh5yaiyd/ambience.db`, copied from local data. Local audio is served from the existing `.local/audio` directory. Created `Preview · Rain`, `Preview · Quiet` and `Preview soundtrack` only in the disposable copy (original copy had no scenes/moods). Library contains 1 environment, 1 ambience, 2 songs and 2 one-shots; multi-distinct-ambience tablet stress needs additional real files later.
- Verified health API, frontend HTTP 200, scene/mood API data, and ranged HTTP 206 responses for each audio category from the desktop. This does not prove tablet reachability or audible playback.
- Preview intentionally left running for the user: exec session `25096`; server log `/tmp/ambience-tablet-preview-bh5yaiyd/server.log`. Stop with Ctrl+C through that session after tests, or identify this exact server process by its copied DB path before stopping it. Do not stop unrelated Node processes. If the session ends, recreate this same isolated preview as needed; do not assume it is still running.
- Next: user opens the LAN URL on the tablet on the same network and checks scene/mood preparation versus Apply, swipe/scroll, off/on fades, Next and master mute. Record actual results before completing task 6. See VERIFICATION.md for the remaining checklist.

### Tablet preview restarted after reboot — 2026-11-04

- Reboot removed the `/tmp` preview database. Recreated the isolated preview from the original local database at `.local/data/tablet-preview/ambience.db` so test edits now survive reboots; restored example scenes/mood when absent. Original local database and production remain untouched.
- Same LAN URL: `http://192.168.2.60:5174`. Server log: `.local/data/tablet-preview/server.log`; current exec session `81069`. Server still needs restarting after reboot; no autostart configuration added.

## 2026-11-04: restore the approved mockup

The form-heavy stage-5 UI and the later selection-tile performance redesign were rejected. `PerformanceMixer.tsx` now ports the approved `design/scene-and-mood.html` composition: scene chips, compact environment, two-column ambience fills, mood buttons, now-playing/queue and bottom one-shots. `performance.css` starts from the original mockup CSS. Forms remain in dialogs; added Apply controls preserve prepared versus active playback. Sound picker category chips replace the dropdown. Do not redesign these surfaces again without a user request.

The home fits 1280×720 and 800×1280 desktop-emulated tablet viewports without page overflow. Long collections open bounded dialogs. Actual Samsung touch, listening and long-session checks remain pending.

### Latest tablet feedback follow-up

Replaced visible environment/music sliders with fill controls, removed repetitive home text, added direct prepared-scene one-shot selection, responsive active shot cards, and a full internally scrolling music queue with compact now-playing. One-shots now use bounded decoded Web Audio playback/cache through master mute. See VERIFICATION.md for checks and the still-unverified physical tablet timeout/layout. Missing sounds are not present in the mounted 63-file share; awaiting an example/location. Background volume balance is a separate decision; existing levels remain preserved.

### Latest user-approved interaction changes

- One-shots never add another row; 144px minimum cards overflow horizontally.
- Edits to the active scene’s one-shots are immediate and require Save for persistence, not Apply. Another prepared scene retains separate shot selections until applied.
- Scene chips mark unsaved edits; Save changes is adjacent to the chips.
- Buttons briefly brighten on activation with reduced-motion support.
- Background card travel maps to 0–20% gain (stored positions remain 0–100). Existing saved backgrounds play five times quieter; music/one-shots keep their full scale.
- Missing audio concern resolved by the user. Browser/device verification of this latest layout remains pending because no browser surface is available.

### 2026-11-05: pending indicators and transport fades

Implemented orange pending-Apply dots, reserved action/footer space and music pause/resume using the selected music fade duration. Build/frontend tests pass. Local browser measurements confirm unchanged panel heights across preparation/Apply/cancel at landscape and portrait tablet sizes; real local music pauses after its fade and resumes at the retained position. See VERIFICATION.md. Publication and physical-tablet listening remain pending.
