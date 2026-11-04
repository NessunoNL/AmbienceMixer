import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const directory = mkdtempSync(join(tmpdir(), 'ambience-drafts-'));
await build({ entryPoints: [join(dirname(dirname(fileURLToPath(import.meta.url))), 'src/mixer/sceneDrafts.ts')], bundle: true, platform: 'node', format: 'esm', outfile: join(directory, 'drafts.mjs') });
const { SceneDrafts, scenePayload, sameScene } = await import(pathToFileURL(join(directory, 'drafts.mjs')));
after(() => rmSync(directory, { recursive: true, force: true }));
const scene = id => ({ id, label: id, icon: 'Trees', environment: { id: '1', name: 'Forest', url: '/1', volume: .6 }, environmentVolume: 60,
  ambiences: [{ audioId: 2, volume: 37, enabled: false, audio: { id: '2', name: 'Rain', url: '/2', volume: .37 } }],
  oneshots: [{ id: '4', name: 'Thunder', url: '/4', icon: 'Zap' }], music: { id: '9', name: 'Legacy', url: '/9', volume: .9 }, musicMode: 'single-loop' });
test('draft edits and cancellation preserve saved data and drafts across scene switching', () => {
  const store = new SceneDrafts(); store.load([scene('a'), scene('b')]);
  store.edit('a', draft => ({ ...draft, label: 'Edited', ambiences: draft.ambiences.map(entry => ({ ...entry, enabled: true, volume: 68 })) }));
  store.select('b'); store.select(null); store.select('a');
  const state = store.getSnapshot();
  assert.equal(state.drafts.a.label, 'Edited'); assert.equal(state.saved.a.label, 'a');
  assert.equal(state.saved.a.ambiences[0].enabled, false);
  assert.equal(sameScene(state.saved.a, state.drafts.a), false);
  store.revert('a'); assert.ok(sameScene(store.getSnapshot().saved.a, store.getSnapshot().drafts.a));
});
test('successful slow save captures request snapshot without erasing newer edits; failed saves need no rollback', () => {
  const store = new SceneDrafts(); store.load([scene('a')]);
  store.edit('a', draft => ({ ...draft, label: 'Request' }));
  const request = structuredClone(store.getSnapshot().drafts.a);
  store.edit('a', draft => ({ ...draft, label: 'Newer edit' }));
  store.saved(request);
  assert.equal(store.getSnapshot().saved.a.label, 'Request');
  assert.equal(store.getSnapshot().drafts.a.label, 'Newer edit');
  // No success callback is made on failure: both versions are retained for retry.
  assert.equal(sameScene(store.getSnapshot().saved.a, store.getSnapshot().drafts.a), false);
});
test('scene payload preserves ordered sounds and disabled levels while omitting legacy music/weather writes', () => {
  const input = scene('a'); input.oneshots.push({ id: '3' }); input.ambiences.push({ audioId: 5, volume: 0, enabled: true });
  const payload = scenePayload(input);
  assert.deepEqual(payload.oneshots, [4, 3]);
  assert.deepEqual(payload.ambiences, [{ audioId: 2, volume: 37, enabled: false }, { audioId: 5, volume: 0, enabled: true }]);
  assert.equal(payload.environment_id, 1); assert.equal(payload.environmentVolume, 60);
  for (const key of ['weather_id', 'weatherVolume', 'music_id', 'musicVolume', 'musicMode', 'musicTagId']) assert.equal(key in payload, false);
});
test('new and deleted drafts do not mutate independently applied snapshots', () => {
  const store = new SceneDrafts(); store.load([scene('a')]);
  const active = structuredClone(store.getSnapshot().drafts.a);
  store.create(); const id = store.getSnapshot().preparedId;
  assert.equal(store.getSnapshot().saved[id], undefined);
  store.remove('a'); assert.equal(active.oneshots[0].id, '4');
  store.remove(id); assert.equal(store.getSnapshot().preparedId, null);
});
