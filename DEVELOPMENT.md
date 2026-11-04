# Local development

Open this folder in VSCodium (Wayland). The Codex extension is recommended; sign in through its sidebar if prompted.

Run `./scripts/dev` in the integrated terminal, or choose **Tasks: Run Task → AmbienceMixer: Preview**. Open http://127.0.0.1:5174. Edits refresh automatically. Ctrl+C stops both servers.

The first run downloads checksum-verified Node 22.23.4 into `.local/node` and installs locked dependencies. Nothing is installed globally. This bootstrap supports Linux x64. The preview binds to loopback, uses API port 3001 and frontend port 5174, and has a separate SQLite database. Put local MP3/WAV files directly in `.local/audio/environment`, `weather`, `music`, and `oneshots`; use Rescan after adding files. Those files and data are ignored by Git.

## Publish when ready

1. Run `./scripts/check` and try the change in the browser.
2. Commit and push to `master` using VSCodium Source Control or Git.
3. Run `./scripts/deploy` from the project root.

Deploy requires the existing SSH key and a clean checkout. It checks the pushed commit, makes a live SQLite backup, preserves the previous Docker image, fast-forwards the server checkout, builds, recreates, and checks the API. It prints the rollback command. Build failure leaves the current container running. Check actual live playback after deployment. Do not prune rollback images until satisfied. Database restoration is separate from image rollback, especially after schema changes.

No automatic publishing is configured. Git contains application code; it does not carry your audio library or scenes. The server's existing NAS mount and persistent data directory remain in use.

## Current baseline

See AGENTS.md for known audio issues. Setup work does not fix or claim to verify those behaviors.

Dependency installation reported advisories in the existing lockfiles (backend: 7, frontend: 26). Review and update dependencies separately; avoid blind `npm audit fix --force`.

## Scene storage: migration and API

Tasks 1–5 of IMPLEMENTATION_PLAN.md provide scene ambience storage, independent music queues and the scene-and-mood interface described below.

Backend startup transactionally migrates each existing weather selection to an enabled ambience at its saved volume. A `schema_migrations` marker prevents re-import on later starts, including after the list is cleared. The migration leaves legacy scene/music fields in place and supports installations predating the volume columns. Back up the database before any eventual production upgrade; the deployment workflow takes a consistent SQLite backup before startup migration.

Scene POST/PUT accepts an ordered `ambiences` array of `{ audioId: number, volume: number, enabled?: boolean }`. Volumes use 0–100; omitted enabled flags default to true. GET returns the same ordered entries with an `audio` object containing the existing audio layer metadata (whose volume uses 0–1). Scene writes use numeric IDs; hydrated audio IDs retain the existing string convention. Partial updates preserve omitted fields; explicit empty arrays clear selections. Invalid categories, references, duplicate entries, volumes or enabled values return 400, duplicate scene IDs return 409, and parent/ambience writes roll back together on failure.

Compatibility: when `ambiences` is supplied, it determines the legacy weather projection using the first enabled entry. Otherwise old weather edits replace/remove only that mapped slot, retaining other ambiences. Legacy volume edits update the mapped ambience. Omitted legacy music fields, including mode/tag metadata, remain stored. The new scene editor omits legacy music fields on save and never applies scene music; mood playback remains independent.

Run the isolated storage/API tests after `./scripts/setup`:

```bash
PATH="$PWD/.local/node/bin:$PATH" npm --prefix backend test
```

Tests build and migrate a copy of an old-schema fixture in a temporary directory and use an ephemeral loopback HTTP listener. They do not read or change the local app database or production data. Run `./scripts/check` separately for frontend compilation and backend syntax checks.

## Sound categories and rescanning

Task 2 adds user-managed categories shared by ambiences (`weather`) and one-shots. They are independent of physical audio folders and music mood tags. Audio files have at most one category; deleting a category leaves its sounds uncategorized. Names are trimmed, limited to 100 characters and unique using SQLite NOCASE comparison. Startup adds the category table and nullable assignment column without moving files. Library now provides category management and sound assignment.

| Endpoint | Contract |
| --- | --- |
| `GET /api/sound-categories` | Sorted array of `{ id, name }` |
| `POST /api/sound-categories` | `{ name }`; returns 201 with `{ success, category }` |
| `PUT /api/sound-categories/:id` | `{ name }`; returns `{ success, category }` |
| `DELETE /api/sound-categories/:id` | Clears assignments via foreign key; returns `{ success, id }` |
| `PUT /api/audio/:id/sound-category` | `{ categoryId }` (number or null); null clears; returns `{ success, audioId, categoryId }` |

Invalid names/IDs and assignments to environment/music return 400; missing records return 404; duplicate category names return 409. `GET /api/audio/library` retains the existing folder groups and adds `soundCategoryId` and `soundCategory: { id, name } | null` to each sound. The scene pickers and Library use these APIs.

Rescans preserve IDs, category assignments, music tags and scene references for unchanged files. Metadata failures preserve existing metadata rather than replacing it with empty values; new files with unreadable metadata are skipped. A directory-read or file-processing failure prevents pruning any existing records in that physical category. Other categories can still update. A successful directory scan still removes genuinely absent files (including in a readable empty directory); this is not protection against a failed mount that presents a valid empty directory.

Scan results add `partial` and `warnings: [{ category, file?, message }]` to the existing counts/duration. Partial scans return HTTP 200 with `success: true, partial: true`; consumers must inspect warnings rather than assume every file was processed. Library displays partial scan warnings and retains session drafts during a refresh. Simultaneous startup/manual scans share one operation, and collected database updates/deletions commit together or roll back together. Tests use temporary real WAV files, corrupt data and unavailable folders; no production scan or physical-device/audio listening test was performed.

## Playback engine (task 3)

The scene-and-mood UI delegates streaming to `StreamMixer` through `AudioEngine.scenes` and `.music`. Start audio is an explicit button, and Apply also unlocks audio; page clicks and restored state do not start playback. One-shot gestures can also unlock audio. Master mute uses a shared bus, so it includes one-shots and fading tails without overwriting channel levels. React teardown disposes audio resources.

`AudioEngine.scenes` exposes `applyScene(scene, seconds = 3)`, `cancelPending()`, `getActiveScene()`, `setAmbienceVolume(sceneId, audioId, percent)` and `setEnvironmentVolume(sceneId, audioId, percent)`. Apply resolves true only when its batch was committed; false means superseded/cancelled, and a load failure rejects. It prepares every replacement before changing the audible scene, keeps music separate, retains unchanged streams, and ignores disabled ambiences. Old scene objects without an ambience list fall back to weather. Live volume updates are accepted only for matching active scene/sound IDs; disabled entries retain levels without starting audio. The editor now uses this controller for Apply while keeping saving and per-scene session drafts separate.

The mixer uses keys `environment`, `ambience:<audioId>`, legacy `weather`, `music` and temporary `oneshot:<id>`. Gain controls are separated into voice transition, channel mix level, channel pause and master mute. Replacement transitions default to three-second equal-power curves, pause/mute to 200 ms, and direct level changes have a 20 ms anti-click ramp. Interrupted fades continue from their calculated current gain. One-shots have a minimal 5 ms entry envelope; the oldest fades out when the ten-shot limit is exceeded. Loading has a 15-second timeout and superseded candidates release their media resources.

Loops stream through overlapping media elements, preloading a second element near the end. Overlap is capped at one quarter of short tracks. Same-source loop overlaps use linear gain pairs to avoid boosting correlated material; native looping remains the fallback if overlap preparation fails, with an error report. Browser timing, buffering and source audio still require listening checks; no claim of gapless playback has been verified. Legacy playlist Next uses the replacement path and failed loads no longer recurse indefinitely. Task 4 now supplies the independent mood queue and ahead-of-end automatic music advancement described below.

Run frontend playback logic tests with:

```bash
PATH="$PWD/.local/node/bin:$PATH" npm --prefix frontend test
```

These tests bundle the TypeScript engine using the esbuild installed with Vite and exercise simulated media/Web Audio objects. They verify state, gain scheduling, cancellation, failure retention, cleanup and loop control, not audible output. To see individual test names directly, run `.local/node/bin/node frontend/test/playback.test.mjs` from the project root.

For real-audio checks, run `./scripts/dev`, then open http://127.0.0.1:5174/audio-check.html. This development-only page uses the local library without saving scenes and exercises two ambiences (choose different files), environment, enable/disable plus Apply, live levels, mute, pause, one-shots and cleanup. It is not part of the production build. Check the main app separately for prepared scene/mood controls and explicit startup. The preview remains loopback-only; testing on the Galaxy Tab needs a separately arranged reachable development preview, not a production deployment.

Task 3 initially passed 13 simulated tests with browser automation unavailable. Task 4 later completed desktop browser smoke checks and extended coverage to 23 simulated tests (see below). Audible smoothness, loop-boundary listening and physical Galaxy Tab verification remain pending. Record device/browser/version and listening results before treating playback as validated on the target device.

## Independent music queue (task 4)

`AudioEngine.music` is a `MusicQueueController`, using existing music tags as moods. Callers fetch the existing `/api/music/by-tag/:id` API and pass a `MusicMood` of `{ id: string, name, tracks: [{ id: string, name, url }] }`; numeric audio/tag IDs are converted to strings at this boundary. No new music storage or tag API is introduced.

- `prepareMood(mood)` changes only the prepared selection; `cancelPrepared()` clears it and cancels pending music work without stopping the active track. Empty moods/duplicate track IDs are rejected.
- `applyPrepared(seconds?)` or `applyMood(mood, seconds?, shuffle?, initialVolume?)` starts a shuffled queue, committing its state only after successful playback preparation. A false result indicates supersession/cancellation; failure rejects and retains the previous queue. Defaults are shuffle enabled, the current music volume, and a three-second transition.
- `getSnapshot()` returns active/prepared mood, current/upcoming tracks, pause/volume state, transitioning/error and track counts. `subscribe(listener)` returns an unsubscribe function; listeners read snapshots, and consumers should also read an initial snapshot.
- `next()` advances; `selectTrack(id)` selects an upcoming track and skips the entries before it. Selecting the current track is a no-op. A failed direct selection keeps the old track. `reshuffleUpcoming()` preserves current playback and upcoming membership while replacing obsolete preload work.
- `setPaused(boolean)`, `setVolume(0–1)`, `setTransitionDuration(seconds)` and `stop(seconds?)` control music independently of scenes. Applying a mood while paused remains silent. Mixer master mute still covers every stream.

After a catalogue is exhausted, the next cycle is shuffled again, avoiding an immediate repeated ID when alternatives exist. Single-song moods restart with a fresh media element. The next song preloads silently; a 100 ms scheduler starts the transition before the current song ends, with an ended-event fallback for unknown duration. Music fades are capped against short incoming/outgoing durations. Manual Next and selection use the same preloaded path. Revisions cancel stale requests, preloads and duplicate advancement from concurrent timer/ended events.

Failed automatic candidates are skipped with at most one attempt per catalogue ID in an advance operation; an entirely unplayable queue stops automatic retries and exposes an error. Explicit Next/selection or applying a mood permits retry. A new unplayable mood preserves previous playback where it is still running; it cannot keep a naturally ended track audible indefinitely. The music panel subscribes to this queue, preserves chosen transition duration, guards stale mood fetches and displays queue errors while keeping the active queue visible during preparation.

The development-only `/audio-check.html` now includes Prepare/Apply/Cancel mood, current/upcoming song controls, pause, shuffle and a near-end seek button. With no tags it can use all local music for testing; that is not a new persisted mood.

Verification: 23 simulated frontend tests pass; `./scripts/check` passes. In the Codex in-app desktop browser, using two local MP3s and a disposable copy of the local SQLite database, verified preparation without playback, Apply, cancelled preparation, overlapping media during Next, pause/resume, automatic advancement after seeking near the end, independent environment/ambience playback, ambience-off cleanup, one-shot invocation, disposal, and legacy queued weather playback. Real media reported readyState 4 with advancing currentTime. A browser-specific detached-media failure was found and fixed by attaching hidden media elements to the document and removing them on cleanup; a regression test covers that lifecycle. This verifies browser mechanics, not perceived audio quality. No physical tablet, audible smoothness, long-session or real loop-boundary validation is claimed. Temporary preview servers were stopped; original local scenes/database and production were not changed.


## Scene editor and tablet interface (task 5)

The main screen has Scene and Music columns, stacking below 900 CSS pixels. Ambiences stay in a two-column grid. Library is a secondary view with rescan results/warnings, sound category create/rename/delete/assignment, and the existing music tag manager presented as moods. No audio folders move.

- Create a scene, name it, select its environment and add ambiences/one-shots. New scenes start as session drafts. Save explicitly persists; Apply explicitly starts/transitions playback and can use an unsaved draft. Legacy scene music settings are retained in storage but ignored by scene playback.
- Switching scenes retains each draft until page reload. Cancel scene clears preparation and cancels in-flight preparation, leaving drafts and active playback intact. Re-select a scene to resume editing. Revert restores its saved draft; it does not Apply. Saving captures the submitted version without erasing newer edits made while the request was running. A failed save retains the draft with retry instructions.
- Deleting a scene does not interrupt its active snapshot. Active one-shot buttons stay with that snapshot until another scene is applied. Prepared one-shots are edited within the scene panel. Their trigger volume is one global preference.
- Drag a volume card horizontally; vertical gestures are reserved for page scrolling. Focus its slider role and use arrows (5%), Page Up/Down (10%), Home/End. There is no visible range slider. Toggle and Remove are separate 44px controls outside the drag area. Off cards remain readable, grey and editable. Actual Playing/Off and Pending on/off labels are separate from prepared On/Off state.
- Volume changes update live audio only for a matching active scene/sound. Different prepared scenes set future levels. Off sounds do not start when their volume changes. Cancellation/Revert do not undo already-applied live volume changes; Apply reconciles the prepared mix.
- Pickers use modal dialogs, search and category filters, a scrolling results region and pinned Done. Selection is retained across filters. Done/Escape close the picker without starting playback.
- Apply all invokes the scene and mood controllers independently. Each preserves its prior playback on preparation failure; successful changes remain active if the other part fails, with a visible partial-failure message. Music Next, song selection, pause, shuffle and master mute use the existing transition engine.
- Only music/one-shot levels and transition durations are restored from local preferences. Loading/restoring never plays audio. Saved scenes load as prepared; Start audio/Apply or a one-shot gesture explicitly resumes audio. Keep screen awake defaults off each session.

`src/mixer/sceneDrafts.ts` owns saved versus draft records; `useMixer.ts` coordinates API/controller state; scene, music, picker, volume-card and Library components own their views. The old single-weather UI is replaced; engine/API compatibility remains available. Frontend tests now include four draft/payload tests alongside 23 playback tests.

The existing Vite PWA manifest/service worker are retained, with app PNG icons at 192px/512px, standalone display and `/` start URL. Browser zoom remains enabled. On a supported browser, use its Install/Add to Home screen command. Installation and Screen Wake Lock require an appropriate secure context (HTTPS in normal hosting; loopback development is treated specially). A plain HTTP LAN preview may lack these capabilities. Do not change production hosting to work around this automatically. See [MDN installation requirements](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API). Offline audio is not supported/promised.

Keep screen awake distinguishes requested versus actually Active, handles unsupported/denied/released locks, releases on hide/disable/unmount, and reacquires on visibility return when still enabled. System release while visible reports Released; toggle to retry. Desktop IAB reported Active when enabled; physical device release/reacquisition and standalone installation remain unverified.

Task 5 verification used a disposable SQLite copy and temporary audio directory, leaving original local data and production untouched. Desktop browser checks covered Save without playback; Apply with real MP3 environment/rain/music plus a generated WAV ambience; unchanged stream continuity; draft switching/cancellation; one-tap removal; keyboard volume; pending Off and applied Off; active one-shot ownership; category creation/assignment; mood creation/bulk assignment; Next with overlapping media; 61-sound picker scrolling/filter selection retention; injected save failure and successful retry; missing-file failure preserving playback; and silent reload. Checked 1280×800 landscape, 800×1280 portrait (stacked without horizontal overflow), and 390×844 picker/focus/Done visibility. This verifies browser behavior, not subjective sound or physical touch. Temporary servers/tab were closed and viewport override reset.

Next is task 6: full integrated regressions, listening, Galaxy Tab S7 FE touch/swipe versus scrolling, PWA installation/wake-lock lifecycle and a 30-minute foreground session. Category rename/delete and scene deletion have backend coverage but still need full UI regression coverage. Actual-device checks remain pending; do not call tablet interaction complete yet.


## Integrated verification progress (task 6)

See [VERIFICATION.md](VERIFICATION.md) for the current results and remaining desktop/tablet checklist. On 2026-11-04, all 31 frontend tests and 19 backend tests passed, along with `./scripts/check` and whitespace checks. The four additional frontend tests cover the extracted `wakeLockSession.ts` lifecycle, including quick visibility return before an old release completes, late acquisition after teardown/hide, rejection and browser release. The hook uses that controller to avoid stale release events clearing a newly acquired lock.

Browser automation was unavailable on resumption; the earlier native rename-prompt timeout and remaining UI checks are unresolved, not passes. The revised wake-lock lifecycle still needs browser and actual-device verification. No listening, tablet gesture, standalone-installation or 30-minute session result has been recorded. Task 6 is in progress, not complete.

## Approved mockup interface (2026-11-04)

The home screen ports the original scene-and-mood mockup rather than presenting the scene editor as the mixer. Scene chips run above the environment/ambience and mood/queue panels. Editing, Library and transition settings open contained dialogs. Home shows up to four ambiences with All sounds for the rest. The full upcoming music queue scrolls inside its panel. All active one-shots appear in a responsive grid, with contained scrolling for large selections. Choose one-shots edits the prepared scene directly; Save persists it and Apply updates the active strip. Environment and music use the same drag/keyboard background-fill volume controls as ambiences. Scene and mood preparation is silent until Apply; Save only persists. The active scene owns the one-shot triggers. Category filters in sound pickers use buttons and remain independent of search.

The user authorized testing on the existing homelab with its full NAS library. Follow `scripts/deploy` and keep database/image backups. A clean temporary checkout may be used to deploy a pushed commit while preserving unrelated local changes.

### One-shot playback

One-shots use fetched, decoded Web Audio buffers instead of streaming media elements. Successful decodes are cached (at most eight clips / 32 MiB decoded memory); downloads larger than 32 MiB are rejected. Playback starts from sample zero through the existing master bus. Up to ten effects overlap; older effects fade out when that limit is reached. Failures are reported and retried only on another explicit trigger. Background gain levels remain unchanged pending a decision about a shared background trim control.
