## Latest: single-row effects and quiet background levels

Implemented one horizontal one-shot row (144px minimum cards), immediate active-scene one-shot editing without Apply, top-of-screen unsaved markers / Save changes, brief button feedback, and 0–20% environment/ambience output over the full card travel. Saved control positions are preserved; existing background output is reduced fivefold. Music/one-shots remain unchanged. The user confirmed there is no missing-audio problem.

Build and frontend tests pass, including immediate shot editing versus saving/reverting, prepared scene isolation, no Apply for one-shot-only changes, scale/accessibility rendering, engine gain mapping and round-trip precision. Browser automation exposes no browsers in this session; horizontal overflow, visual feedback and physical tablet gestures remain unverified.

## Tablet-feedback follow-up

Implemented: remove explanatory home copy; direct prepared-scene one-shot selection; responsive active one-shot grid; full queue scrolling inside its card; compact current song; fill-only environment/music volumes. Save/Apply and active-scene one-shot separation are preserved.

`./scripts/check` passes. Targeted tests: 25 playback tests and two home-render tests pass, including master mute, bounded one-shot overlap, decoded-buffer reuse, HTTP failure/retry, disposal during loading, full queue/shot rendering and active/prepared scene separation.

Live `/api/audio/1333/stream` returns a complete 661132-byte PCM WAV (24 kHz, stereo, 6.886 seconds). The old media-element timeout could not be reproduced because browser automation is unavailable in this session (no browser surfaces). The new decoded-buffer playback path needs an actual tablet retry. New layout, pointer gestures and audible output have not yet been browser/device verified.

The mounted NAS still has 63 files, all indexed; a missing filename or expected folder/share is needed to investigate additional audio. Do not claim missing audio has been recovered. Saved scene volume levels were not changed.

# Latest UI verification — 2026-11-04

The original mockup composition has replaced the two rejected home layouts. Production testing is now explicitly authorized by the user.

- `./scripts/check` passes; backend tests: 19 pass; frontend playback/draft/wake-lock tests and two home-render tests pass.
- Browser: explicit Apply starts the local environment, ambience and music; remove is one tap and Revert restores the draft.
- Measured document size equals viewport at 1280×720 and 800×1280. Portrait and landscape screenshots inspected.
- Sound picker is bounded to the viewport, with search, category buttons, scrolling results and pinned Done.
- Physical tablet touch, audible fades and extended sessions remain unverified. Older checklists below remain useful; their local-only deployment restrictions are superseded by the user's homelab-test authorization.

# Scene-and-mood verification

## Current result — 2026-11-04

Automated local checks pass: 23 playback tests, four scene-draft/payload tests, four wake-lock lifecycle tests, and 19 backend tests. `./scripts/check` and `git diff --check` pass. Existing browser-data freshness warnings remain. Backend tests use isolated temporary databases, including an old-schema migration fixture and repeated startup; they do not migrate production.

Task 5 desktop browser results are recorded in IMPLEMENTATION_PLAN.md. They cover actual media playback state and UI behavior, not listening or physical touch. Task 6 browser verification was interrupted at a native category-rename prompt. On resumption, browser inventory was empty and creating the embedded browser failed. Category rename/delete, scene deletion, and the revised wake-lock lifecycle are therefore **not yet browser-verified**. Task 6 remains incomplete.

## Local desktop checks to finish

Run `./scripts/dev` and open http://127.0.0.1:5174 on the development computer. Ctrl+C stops the preview. This uses `.local/data` and `.local/audio`, not production. Create clearly named test scenes/categories for deletion checks; do not delete existing user scenes or categories merely to test. Automated browser work should continue using a disposable database copy as in task 5.

- [ ] Rename a test sound category. Confirm its assigned sounds show the new name in Library and the picker. Delete that test category; its sounds must remain available as Uncategorized.
- [ ] Create and save a test scene with an environment, ambience and one-shot. Apply it, then delete it. Its active sound and one-shot strip must remain until another scene is applied; it must disappear from saved scene choices after reload.
- [ ] Prepare both scene and mood, then Apply all. Both become active. Repeat with a missing replacement file in disposable fixtures; report the failed part and retain its previous playback while the successful part becomes active.
- [ ] Keep a mood playing while preparing and cancelling another mood. The current queue must stay visible and playing. Selecting an upcoming song and Next must use fades; reshuffle must leave the current song uninterrupted.
- [ ] Enable Keep screen awake, switch away and back quickly, then disable it. Active means a lock is held; Off/Unavailable/Released must be accurate. Returning while still enabled should reacquire when supported. Repeat with a denied/unsupported browser where available; audio should be unaffected.

## Samsung Galaxy Tab S7 FE checks

The desktop loopback URL above cannot be opened from the tablet. Arrange a separately configured, reachable development preview first; no LAN exposure or production deployment has been performed. Use a trusted secure preview for installation/wake-lock tests. A plain HTTP LAN preview may support audio/UI but not those features. Do not change production hosting just to run these tests.

Record browser name/version, Android version, preview URL, orientation and output device (tablet speaker/Bluetooth/wired). Use two test scenes sharing at least one ambience, two moods, two or more ambiences and a one-shot.

- [ ] **Touch:** in landscape and portrait, drag an ambience sideways to change its volume. Swipe vertically over that card to scroll without changing volume. Toggle and Remove each work on the first tap. Off cards remain editable and do not start playing when their volume changes.
- [ ] **Preparation:** select another scene, change sounds/one-shots and press Save or picker Done. Playback and the active one-shot strip stay unchanged. Apply makes the changes. Cancel leaves playback alone and preserves the draft for reselection.
- [ ] **Listening:** listen for clicks, gaps and abrupt level jumps during scene/mood Apply, Next, manual and automatic song advancement, ambience Off/On, pause/resume, mute/unmute and loop boundaries. Try rapid repeated actions and changes during a fade. Shared ambiences should continue without restarting. Music volume should remain stable. One-shots should retain their attack; master mute should silence everything, including one-shots and fading sounds.
- [ ] **Installation and awake:** install from the browser and launch from the home screen. Confirm standalone layout. Enable/disable Keep screen awake and switch away/back; check actual screen behavior and the status text. Reload must remain silent until an explicit playback gesture.
- [ ] **30-minute session:** keep the mixer in the foreground with multiple ambiences and music, use controls periodically, and note dropouts, increasing sluggishness, overheating or unexpected screen dimming. Briefly switch away/back and check sensible recovery. Uninterrupted locked-screen playback is not a requirement.

Report failures as: action → expected result → actual result, with the scene/mood and selected sounds. Record the completed session duration and mix size. Leave unchecked items pending rather than treating desktop emulation as tablet evidence.

## Current temporary tablet preview — 2026-11-04

Open **http://192.168.2.60:5174** on the tablet while connected to the same LAN as the development desktop. The preview has been started for this test session; availability is temporary. It serves the built app using a disposable database, with `Preview · Rain`, `Preview · Quiet` and `Preview soundtrack`. Saves/deletions here affect only the temporary copy. Original local data and production are unchanged.

Begin with Rain and the soundtrack, then Apply all. Prepare Quiet and verify Rain continues until Apply scene. Swipe volume sideways, scroll vertically over the card, try Next and master mute. Report any action that sounds abrupt or behaves unexpectedly. This library currently has only one ambience: full multiple-distinct-ambience stress remains pending.

HTTP health/page/ranged audio responses have been checked from the desktop. Tablet access and actual playback are not verified yet. This HTTP LAN preview may not support wake lock or PWA installation; use a separately arranged trusted HTTPS preview for those checks. No security-warning bypass is part of the test.

## Homelab publication — 2026-11-04

Published the mockup-based mixer via `scripts/deploy` from a clean temporary checkout; unrelated local editor/CLAUDE changes were preserved. Live URL: https://ambience.home.brouwerhomelab.nl. Health passed and the normal HTTPS page loaded the new UI with existing scenes/moods. Browser Apply started real NAS environment and music streams (media readyState 4); Next advanced the queue. No saved scenes or library assignments were changed by these smoke checks.

Retained database backup: `/opt/docker/AmbienceMixer/data/ambience.db.backup-20261104T140752Z`. Previous image: `ambience-mixer:rollback-20261104T140752Z`. Rollback override: `.local/deploy/rollback-20261104T140752Z.yml` in the server checkout. Database restore remains a separate decision.

The live library contains 63 files: 16 environments, 28 music tracks, 18 one-shots, and **one ambience** in the existing `weather` folder. The full library is available, but this is not a large-ambience-library stress test. Physical tablet, audible smoothness and long-session checks remain open.
