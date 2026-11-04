import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, renameSync, unlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';

const directory = mkdtempSync(join(tmpdir(), 'ambience-library-'));
process.env.DB_PATH = join(directory, 'test.db');
process.env.AUDIO_DIR = join(directory, 'audio');
const { default: db } = await import('../src/services/database.js');
const { default: scanner } = await import('../src/services/audioScanner.js');
const { default: audioRouter } = await import('../src/routes/audio.js');
const { default: categoriesRouter } = await import('../src/routes/soundCategories.js');
const { default: scenesRouter } = await import('../src/routes/scenes.js');

// Valid PCM WAV files exercise the real filesystem and metadata parser.
function wav(path, dataLength = 1600) {
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write('RIFF'); buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVEfmt ', 8); buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(dataLength, 40);
  writeFileSync(path, buffer);
}
const file = (category, name = 'sound.wav') => join(process.env.AUDIO_DIR, category, name);
for (const category of ['environment', 'weather', 'music', 'oneshots']) {
  mkdirSync(join(process.env.AUDIO_DIR, category), { recursive: true });
  wav(file(category));
}
const app = express();
app.use(express.json());
app.use('/api/audio', audioRouter);
app.use('/api/sound-categories', categoriesRouter);
app.use('/api/scenes', scenesRouter);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
async function request(path, method = 'GET', body) {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}
const assign = (id, categoryId) => request(`/audio/${id}/sound-category`, 'PUT', { categoryId });
let nature, creatures, weatherId, shotId, musicId;

test('sound categories and failure-safe scanning', async t => {
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });

  await t.test('real audio scan and category CRUD support assignments and uncategorized sounds', async () => {
    const scan = await request('/audio/scan', 'POST');
    assert.equal(scan.status, 200);
    assert.equal(scan.body.totalFiles, 4);
    assert.equal(scan.body.partial, false);
    const library = (await request('/audio/library')).body;
    weatherId = library.weather[0].id; shotId = library.oneshots[0].id; musicId = library.music[0].id;
    assert.equal(library.weather[0].soundCategoryId, null);
    const create = await request('/sound-categories', 'POST', { name: ' Nature ' });
    assert.equal(create.status, 201);
    nature = create.body.category.id;
    creatures = (await request('/sound-categories', 'POST', { name: 'Creatures' })).body.category.id;
    assert.equal((await assign(weatherId, nature)).status, 200);
    assert.equal((await assign(shotId, nature)).status, 200);
    assert.equal((await assign(shotId, creatures)).status, 200);
    const updated = (await request('/audio/library')).body;
    assert.deepEqual(updated.weather[0].soundCategory, { id: nature, name: 'Nature' });
    assert.equal(updated.oneshots[0].soundCategoryId, creatures);
    assert.equal((await request(`/sound-categories/${nature}`, 'PUT', { name: 'Wilderness' })).status, 200);
    assert.equal((await request('/audio/library')).body.weather[0].soundCategory.name, 'Wilderness');
    assert.deepEqual((await request('/sound-categories')).body.map(c => c.name), ['Creatures', 'Wilderness']);
    await assign(shotId, null);
    assert.equal(db.getAudioFileById(shotId).sound_category_id, null);
    await assign(shotId, creatures);
  });

  await t.test('invalid, missing and duplicate category requests have explicit errors', async () => {
    for (const name of ['', '  ', null, 42, 'x'.repeat(101)]) {
      assert.equal((await request('/sound-categories', 'POST', { name })).status, 400);
    }
    assert.equal((await request('/sound-categories', 'POST', { name: 'wilderness' })).status, 409);
    assert.equal((await request(`/sound-categories/${creatures}`, 'PUT', { name: 'Wilderness' })).status, 409);
    assert.equal((await request('/sound-categories/999', 'DELETE')).status, 404);
    assert.equal((await request('/sound-categories/1oops', 'PUT', { name: 'X' })).status, 400);
    assert.equal((await assign(musicId, nature)).status, 400);
    assert.equal((await assign(db.getAudioFilesByCategory('environment')[0].id, nature)).status, 400);
    assert.equal((await assign(999, nature)).status, 404);
    assert.equal((await assign(weatherId, 999)).status, 404);
    for (const categoryId of ['1', 0, -1, 1.5, true]) assert.equal((await assign(weatherId, categoryId)).status, 400);
    assert.equal((await request(`/audio/${weatherId}/sound-category`, 'PUT', {})).status, 400);
    assert.equal(db.getAudioFileById(weatherId).sound_category_id, nature);
  });

  await t.test('rescan and repeated migrations preserve IDs, categories, scenes and music tags', async () => {
    const tag = db.insertMusicTag({ name: 'Calm', color: null }).lastInsertRowid;
    db.addTagToAudioFile(musicId, tag);
    assert.equal((await request('/scenes', 'POST', {
      id: 'scene', label: 'Test', icon: 'Cloud', oneshots: [shotId],
      ambiences: [{ audioId: weatherId, volume: 32, enabled: false }],
    })).status, 201);
    const before = db.getAllAudioFiles();
    db.initialize();
    const result = await scanner.scanDirectory();
    assert.equal(result.deletedCount, 0);
    assert.deepEqual(db.getAllAudioFiles(), before);
    assert.deepEqual(db.getSceneAmbiences('scene'), [{ audioId: weatherId, volume: 32, enabled: false }]);
    assert.equal(db.getTagsForAudioFile(musicId)[0].id, tag);
  });

  await t.test('unavailable folder retains all its records and reports a partial scan', async () => {
    const before = db.getAudioFileById(weatherId);
    const path = join(process.env.AUDIO_DIR, 'weather');
    renameSync(path, path + '-offline');
    try {
      const { body } = await request('/audio/scan', 'POST');
      assert.equal(body.partial, true);
      assert.equal(body.warnings[0].category, 'weather');
      assert.equal(body.deletedCount, 0);
      assert.deepEqual(db.getAudioFileById(weatherId), before);
      assert.equal(db.getSceneAmbiences('scene')[0].audioId, weatherId);
    } finally { renameSync(path + '-offline', path); }
  });

  await t.test('metadata and stat failures retain metadata and prevent deletion in that category', async () => {
    wav(file('weather', 'other.wav'));
    await scanner.scanDirectory();
    const other = db.getAudioFilesByCategory('weather').find(audio => audio.id !== weatherId);
    const before = db.getAudioFileById(weatherId);
    unlinkSync(file('weather', 'other.wav'));
    writeFileSync(file('weather'), 'not a WAV file');
    symlinkSync(join(directory, 'nonexistent'), file('weather', 'broken.wav'));
    try {
      const result = await scanner.scanDirectory();
      assert.equal(result.partial, true);
      assert.equal(result.warnings.filter(w => w.category === 'weather').length, 2);
      assert.deepEqual(db.getAudioFileById(weatherId), before);
      assert.ok(db.getAudioFileById(other.id), 'No category pruning after a processing failure');
      assert.equal(db.getSceneAmbiences('scene')[0].audioId, weatherId);
    } finally { wav(file('weather')); unlinkSync(file('weather', 'broken.wav')); }
    const recovered = await scanner.scanDirectory();
    assert.equal(recovered.partial, false);
    assert.equal(recovered.deletedCount, 1);
    assert.equal(db.getAudioFileById(other.id), undefined);
  });

  await t.test('concurrent scans share a snapshot and failed writes roll back the entire scan', async () => {
    const first = scanner.scanDirectory();
    assert.equal(scanner.scanDirectory(), first);
    await first;
    const before = db.getAllAudioFiles();
    wav(file('environment'), 3200); // Ensure an earlier UPSERT actually changes metadata before failure.
    wav(file('weather', 'new.wav'));
    db.db.exec(`CREATE TRIGGER reject_scan BEFORE INSERT ON audio_files
      WHEN NEW.path = '/audio/weather/new.wav' BEGIN SELECT RAISE(ABORT, 'Injected scan failure'); END`);
    try {
      await assert.rejects(scanner.scanDirectory(), /Injected scan failure/);
      assert.deepEqual(db.getAllAudioFiles(), before);
    } finally { db.db.exec('DROP TRIGGER reject_scan'); unlinkSync(file('weather', 'new.wav')); wav(file('environment')); }
    assert.equal((await scanner.scanDirectory()).partial, false);
  });

  await t.test('category deletion clears assignments without deleting audio or scene entries', async () => {
    assert.equal((await request(`/sound-categories/${nature}`, 'DELETE')).status, 200);
    assert.equal(db.getAudioFileById(weatherId).sound_category_id, null);
    assert.equal(db.getSceneAmbiences('scene')[0].audioId, weatherId);
    assert.equal((await request('/audio/library')).body.weather[0].soundCategory, null);
    assert.equal((await request(`/sound-categories/${creatures}`, 'DELETE')).status, 200);
    assert.equal(db.getAudioFileById(shotId).sound_category_id, null);
    assert.equal(db.getSceneById('scene').oneshots, JSON.stringify([shotId]));
    assert.deepEqual(db.db.pragma('foreign_key_check'), []);
  });
});
