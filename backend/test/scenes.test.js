import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';

// Build an old-format database, then migrate a copy, never the user's database.
const directory = mkdtempSync(join(tmpdir(), 'ambience-scenes-'));
const original = join(directory, 'legacy.db');
const fixture = new Database(original);
fixture.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8'));
for (const [id, category] of [[1, 'environment'], [2, 'weather'], [3, 'weather'], [4, 'music'], [5, 'oneshots'], [6, 'oneshots']]) {
  fixture.prepare('INSERT INTO audio_files (id, path, name, category, format) VALUES (?, ?, ?, ?, ?)')
    .run(id, `/audio/${category}/${id}.mp3`, `Sound ${id}`, category, 'mp3');
}
fixture.exec(`INSERT INTO scenes (id, label, icon, environment_id, weather_id, music_id, oneshots, environment_volume, weather_volume, music_volume)
  VALUES ('legacy', 'Legacy scene', 'Trees', 1, 2, 4, '[6,5]', 72, 37, 61)`);
fixture.close();
const databasePath = join(directory, 'copy.db');
copyFileSync(original, databasePath);
process.env.DB_PATH = databasePath;
const { default: db } = await import('../src/services/database.js');
const { default: router } = await import('../src/routes/scenes.js');
const app = express();
app.use(express.json());
app.use('/scenes', router);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
const base = `http://127.0.0.1:${server.address().port}/scenes`;
async function request(path = '', method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
const entry = (audioId, volume, enabled = true) => ({ audioId, volume, enabled });

test('scene migration and API compatibility', async t => {
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  await t.test('migrates old weather once and preserves scene and legacy data', async () => {
    assert.deepEqual(db.getSceneAmbiences('legacy'), [entry(2, 37)]);
    db.initialize();
    assert.deepEqual(db.getSceneAmbiences('legacy'), [entry(2, 37)]);
    const { body } = await request('/legacy');
    assert.equal(body.environment.id, '1');
    assert.equal(body.environmentVolume, 72);
    assert.equal(body.music.id, '4');
    assert.equal(body.musicVolume, 61);
    assert.deepEqual(body.oneshots.map(sound => sound.id), ['6', '5']);
    assert.equal(body.ambiences[0].audio.url, '/api/audio/2/stream');
    const untouched = new Database(original, { readonly: true });
    assert.equal(untouched.prepare("SELECT name FROM sqlite_master WHERE name = 'scene_ambiences'").get(), undefined);
    untouched.close();
  });

  await t.test('legacy create and partial update preserve omitted fields and one-shots', async () => {
    assert.equal((await request('', 'POST', { id: 'old-ui', label: 'Old UI', icon: 'Cloud', weather_id: 2, weatherVolume: 24, oneshots: [5] })).status, 201);
    assert.deepEqual(db.getSceneAmbiences('old-ui'), [entry(2, 24)]);
    assert.equal((await request('/old-ui', 'PUT', { label: 'Renamed' })).status, 200);
    assert.equal(db.getSceneById('old-ui').oneshots, '[5]');
    assert.deepEqual(db.getSceneAmbiences('old-ui'), [entry(2, 24)]);
    assert.equal((await request('', 'POST', { id: 'old-ui', label: 'Duplicate', icon: 'Cloud' })).status, 409);
  });

  await t.test('ordered ambiences and enabled flags round-trip; music fields survive new writes', async () => {
    db.db.exec("INSERT INTO music_tags (id, name) VALUES (1, 'Calm'); UPDATE scenes SET music_mode = 'tag-shuffle', music_tag_id = 1 WHERE id = 'legacy'");
    assert.equal((await request('/legacy', 'PUT', { ambiences: [entry(3, 0, false), { audioId: 2, volume: 81.5 }] })).status, 200);
    assert.deepEqual(db.getSceneAmbiences('legacy'), [entry(3, 0, false), entry(2, 81.5)]);
    const { body } = await request('/legacy');
    assert.equal(body.weather.id, '2');
    assert.equal(body.weatherVolume, 81.5);
    assert.equal(body.musicMode, 'tag-shuffle');
    assert.equal(body.musicTagId, 1);
    assert.equal(body.music.id, '4');
    assert.deepEqual(body.oneshots.map(sound => sound.id), ['6', '5']);
    // A current-UI save must not destroy additional ambiences or disabled flags.
    await request('/legacy', 'PUT', { weather_id: 2, weatherVolume: 50 });
    assert.deepEqual(db.getSceneAmbiences('legacy'), [entry(3, 0, false), entry(2, 50)]);
  });

  await t.test('legacy replacement/removal affects only its mapped slot', async () => {
    await request('/old-ui', 'PUT', { weather_id: 3 });
    assert.deepEqual(db.getSceneAmbiences('old-ui'), [entry(3, 24)]);
    await request('/legacy', 'PUT', { weather_id: null });
    assert.deepEqual(db.getSceneAmbiences('legacy'), [entry(3, 0, false)]);
  });

  await t.test('empty list stays empty after reopening, even with archived weather data', async () => {
    await request('/legacy', 'PUT', { ambiences: [], oneshots: [] });
    // Simulate a retained legacy value: the migration marker, not emptiness, controls backfill.
    db.db.exec("UPDATE scenes SET weather_id = 2 WHERE id = 'legacy'");
    db.close();
    db.db = new Database(databasePath);
    db.db.pragma('foreign_keys = ON');
    db.initialize();
    assert.deepEqual(db.getSceneAmbiences('legacy'), []);
    assert.deepEqual((await request('/legacy')).body.oneshots, []);
  });

  await t.test('invalid payloads are rejected without changing stored data', async () => {
    const before = db.getSceneById('old-ui');
    for (const body of [
      { environment_id: 2 }, { weather_id: 999 }, { music_id: '4' },
      { oneshots: [2] }, { oneshots: [5, 5] }, { oneshots: null },
      { environmentVolume: -1 }, { musicVolume: 101 }, { weatherVolume: null },
      { label: '' }, { ambiences: null }, { ambiences: [null] },
      { ambiences: [entry(1, 50)] }, { ambiences: [entry(999, 50)] },
      { ambiences: [entry(2, -1)] }, { ambiences: [entry(2, 101)] },
      { ambiences: [{ audioId: 2, volume: '50' }] },
      { ambiences: [entry(2, 50, 0)] }, { ambiences: [entry(2, 50, null)] },
      { ambiences: [entry(2, 50), entry(2, 60)] },
    ]) {
      assert.equal((await request('/old-ui', 'PUT', body)).status, 400, JSON.stringify(body));
      assert.deepEqual(db.getSceneById('old-ui'), before);
    }
    assert.equal((await request('/missing', 'PUT', { label: 'No' })).status, 404);
  });

  await t.test('database failure rolls back parent and all child changes for create and update', async () => {
    const before = db.getSceneById('old-ui');
    const children = db.getSceneAmbiences('old-ui');
    db.db.exec(`CREATE TRIGGER reject_test_ambience BEFORE INSERT ON scene_ambiences
      WHEN NEW.audio_id = 2 BEGIN SELECT RAISE(ABORT, 'Injected write failure'); END`);
    try {
      assert.equal((await request('/old-ui', 'PUT', { label: 'Must roll back', ambiences: [entry(3, 60), entry(2, 70)] })).status, 500);
      assert.deepEqual(db.getSceneById('old-ui'), before);
      assert.deepEqual(db.getSceneAmbiences('old-ui'), children);
      assert.equal((await request('', 'POST', { id: 'rollback', label: 'No', icon: 'Cloud', ambiences: [entry(2, 10)] })).status, 500);
      assert.equal(db.getSceneById('rollback'), undefined);
    } finally { db.db.exec('DROP TRIGGER reject_test_ambience'); }
  });

  await t.test('all-disabled scene retains volumes and exposes no legacy weather playback', async () => {
    const ambiences = [entry(2, 35, false), entry(3, 65, false)];
    assert.equal((await request('', 'POST', { id: 'off', label: 'Off', icon: 'Cloud', ambiences })).status, 201);
    db.initialize();
    const { body } = await request('/off');
    assert.equal(body.weather, undefined);
    assert.deepEqual(body.ambiences.map(({ audio, ...value }) => value), ambiences);
    await request('/off', 'PUT', { weather_id: null, weatherVolume: 45 });
    assert.deepEqual(db.getSceneAmbiences('off'), ambiences);
  });

  await t.test('installations predating volume columns receive defaults before backfill', () => {
    const current = db.db;
    const older = new Database(':memory:');
    try {
      older.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf8')
        .replace(/^  (environment|weather|music)_volume.*\n/gm, ''));
      older.exec(`INSERT INTO audio_files (id, path, name, category, format) VALUES (1, '/audio/weather/rain.mp3', 'Rain', 'weather', 'mp3');
        INSERT INTO scenes (id, label, icon, weather_id, oneshots) VALUES ('ancient', 'Ancient', 'Cloud', 1, '[]')`);
      db.db = older;
      db.initialize();
      assert.deepEqual(db.getSceneAmbiences('ancient'), [entry(1, 45)]);
      assert.equal(db.getSceneById('ancient').environment_volume, 70);
      assert.equal(db.getSceneById('ancient').music_volume, 60);
    } finally {
      db.db = current;
      older.close();
    }
  });

  await t.test('deleting a scene removes its ambience rows', async () => {
    assert.equal((await request('/old-ui', 'DELETE')).status, 200);
    assert.deepEqual(db.getSceneAmbiences('old-ui'), []);
    assert.equal((await request('/old-ui')).status, 404);
    assert.deepEqual(db.db.pragma('foreign_key_check'), []);
  });
});
