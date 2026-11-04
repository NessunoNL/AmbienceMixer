import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const directory = mkdtempSync(join(tmpdir(), 'ambience-playback-'));
await build({ stdin: { contents: `export { AudioEngine } from './src/audioEngine'; export { GainEnvelope } from './src/audio/transitions';`, resolveDir: dirname(dirname(fileURLToPath(import.meta.url))), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: join(directory, 'engine.mjs') });
const { AudioEngine, GainEnvelope } = await import(pathToFileURL(join(directory, 'engine.mjs')));
after(() => rmSync(directory, { recursive: true, force: true }));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
class Param {
  value = 1; events = [];
  setTargetAtTime(value) { this.value = value; }
  cancelScheduledValues(time) { this.events.push(['cancel', time]); }
  setValueAtTime(value, time) { this.events.push(['set', value, time]); this.value = value; }
  setValueCurveAtTime(values, time, duration) { this.events.push(['curve', values, time, duration]); }
}
class Node {
  gain = new Param(); disconnected = false; destination;
  connect(node) { this.destination = node; }
  disconnect() { this.disconnected = true; }
}
class Context {
  currentTime = 0; state = 'suspended'; destination = {}; nodes = []; sources = [];
  createGain() { const node = new Node(); this.nodes.push(node); return node; }
  createMediaElementSource(audio) { const node = new Node(); node.audio = audio; this.sources.push(node); return node; }
  async decodeAudioData() { return { length: 48000, numberOfChannels: 2 }; }
  createBufferSource() { const node = new Node(); node.start = () => {}; node.stop = () => node.onended?.(); this.sources.push(node); return node; }
  async resume() { this.state = 'running'; }
  async close() { this.state = 'closed'; }
}
class Audio extends EventTarget {
  static instances = []; static blocked = new Set(); static failures = new Set();
  currentTime = 0; duration = 30; readyState = 4; paused = true; ended = false; loop = false;
  plays = 0; release; src;
  constructor(url) { super(); this.src = url; Audio.instances.push(this); }
  play() {
    this.plays++; this.paused = false;
    if (Audio.failures.has(this.src)) return Promise.reject(new Error('load failure'));
    if (Audio.blocked.has(this.src)) return new Promise(resolve => { this.release = resolve; });
    return Promise.resolve();
  }
  pause() { this.paused = true; }
  setAttribute() {}
  load() { if (this.src) this.dispatchEvent(new Event(Audio.failures.has(this.src) ? 'error' : 'canplay')); }
  removeAttribute() { this.src = ''; }
}
globalThis.Audio = Audio;
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) });
const body = { children: new Set(), append(audio) { this.children.add(audio); audio.parentNode = this; },
  removeChild(audio) { this.children.delete(audio); audio.parentNode = undefined; } };
globalThis.document = { body };
async function engine(t) {
  Audio.instances = []; Audio.failures.clear(); Audio.blocked.clear();
  const context = new Context(); const engine = new AudioEngine(context);
  t.after(() => engine.dispose());
  await engine.resume();
  return { engine, context, mixer: engine.mixer };
}
const ambience = (id, enabled = true, volume = 40) => ({ audioId: id, enabled, volume, audio: { id: String(id), name: `Sound ${id}`, url: `sound-${id}`, volume: volume / 100 } });
const scene = (id, ambiences, environment) => ({ id, label: id, icon: 'Cloud', ambiences, environment, environmentVolume: 60, oneshots: [] });

test('construction and restored state never start audio without explicit resume', async t => {
  const context = new Context(); const engine = new AudioEngine(context);
  t.after(() => engine.dispose());
  assert.equal(context.state, 'suspended');
  await assert.rejects(engine.loadLayer('environment', 'rain'), /user gesture/);
  assert.equal(context.sources.length, 0);
});

test('multiple ambiences, shared-track continuity, disabled entries and independent music', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.loadLayer('music', 'music', 0.4, 0);
  const music = mixer.getAudio('music');
  await engine.scenes.applyScene(scene('first', [ambience(1), ambience(2), ambience(3, false)]), 0);
  const shared = mixer.getAudio('ambience:2'); shared.currentTime = 12;
  assert.ok(mixer.getAudio('ambience:1'));
  assert.equal(mixer.getAudio('ambience:3'), undefined);
  await engine.scenes.applyScene(scene('second', [ambience(2), ambience(4)]), 0);
  await wait(5);
  assert.equal(mixer.getAudio('ambience:2'), shared);
  assert.equal(shared.currentTime, 12);
  assert.equal(mixer.getAudio('ambience:1'), undefined);
  assert.equal(mixer.getAudio('music'), music);
  assert.equal(engine.scenes.getActiveScene().id, 'second');
});
// Avoid shadowing the helper with destructured engine variables in tests.
const engineFixture = engine;

test('scene changes wait for all replacements, and failure retains every old stream', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.scenes.applyScene(scene('old', [ambience(1)]), 0);
  const old = mixer.getAudio('ambience:1');
  Audio.blocked.add('sound-2');
  const pending = engine.scenes.applyScene(scene('new', [ambience(2), ambience(3)]), 0.02);
  await wait(0);
  assert.equal(mixer.getAudio('ambience:1'), old);
  assert.equal(mixer.getAudio('ambience:3'), undefined);
  assert.equal(old.paused, false);
  Audio.instances.find(audio => audio.src === 'sound-2').release();
  assert.equal(await pending, true);
  assert.equal(old.paused, false, 'old stream continues during fade');
  await wait(30); assert.equal(old.paused, true);
  const active = mixer.getAudio('ambience:2');
  Audio.failures.add('sound-5');
  await assert.rejects(engine.scenes.applyScene(scene('bad', [ambience(4), ambience(5)]), 0), /load failure/);
  await wait(0);
  assert.equal(mixer.getAudio('ambience:2'), active);
  assert.equal(engine.scenes.getActiveScene().id, 'new');
  assert.equal(Audio.instances.find(audio => audio.src === 'sound-4'), undefined, 'successful sibling candidate also released');
});

test('superseded and cancelled preparations cannot commit or leak streams', async t => {
  const { engine, mixer, context } = await engineFixture(t);
  Audio.blocked.add('sound-1');
  const first = engine.scenes.applyScene(scene('slow', [ambience(1)]), 0);
  await wait(0);
  const slow = Audio.instances.find(audio => audio.src === 'sound-1');
  await engine.scenes.applyScene(scene('new', [ambience(2)]), 0);
  assert.equal(await first, false); slow.release();
  await wait(0);
  assert.equal(slow.src, '');
  assert.equal(engine.scenes.getActiveScene().id, 'new');
  Audio.blocked.add('sound-3');
  const cancelled = engine.scenes.applyScene(scene('cancel', [ambience(3)]), 0);
  engine.scenes.cancelPending();
  assert.equal(await cancelled, false);
  assert.ok(mixer.getAudio('ambience:2'));
  await engine.dispose();
  assert.equal(context.state, 'closed');
  assert.ok(context.sources.every(source => source.disconnected));
  assert.ok(Audio.instances.every(audio => audio.paused && !audio.src));
});

test('off volume edits do not play, while re-enable restores saved volume', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.scenes.applyScene(scene('mix', [ambience(1)]), 0);
  const off = scene('mix', [ambience(1, false, 65)]);
  await engine.scenes.applyScene(off, 0); await wait(5);
  const count = Audio.instances.length;
  engine.scenes.setAmbienceVolume('mix', 1, 80);
  assert.equal(Audio.instances.length, count);
  assert.equal(mixer.getAudio('ambience:1'), undefined);
  assert.equal(engine.scenes.getActiveScene().ambiences[0].volume, 80);
  const on = engine.scenes.getActiveScene(); on.ambiences[0].enabled = true;
  await engine.scenes.applyScene(on, 0);
  assert.equal(mixer.channels.get('ambience:1').volume, 0.8);
  engine.scenes.setAmbienceVolume('different-draft', 1, 10);
  assert.equal(mixer.channels.get('ambience:1').volume, 0.8);
});

test('master mute covers streams, tails and one-shots without changing levels', async t => {
  const { engine, mixer, context } = await engineFixture(t);
  await engine.loadLayer('environment', 'old', 0.6, 0);
  await engine.loadLayer('environment', 'new', 0.6, 0.02);
  await engine.playOneShot('shot', 0.7);
  engine.setMuted(true); context.currentTime += 0.2;
  assert.equal(mixer.masterGain.value, 0);
  for (const source of context.sources) {
    let node = source;
    while (node.destination && node.destination !== context.destination) node = node.destination;
    assert.equal(node, mixer.master);
  }
  assert.equal(mixer.channels.get('environment').volume, 0.6);
  engine.setVolume('environment', 0.3);
  assert.equal(mixer.masterGain.value, 0);
  engine.setMuted(false); context.currentTime += 0.2;
  assert.ok(Math.abs(mixer.masterGain.value - 1) < 1e-6);
  assert.equal(mixer.channels.get('environment').volume, 0.3);
});

test('pause waits for fade, resume preserves position, rapid commands do not pause later', async t => {
  const { engine, mixer, context } = await engineFixture(t);
  await engine.loadLayer('music', 'song', 0.4, 0);
  const audio = mixer.getAudio('music'); audio.currentTime = 10;
  await engine.setPaused('music', true);
  assert.equal(audio.paused, false);
  await wait(220); context.currentTime += 0.2;
  assert.equal(audio.paused, true);
  assert.equal(audio.currentTime, 10);
  await engine.setPaused('music', false);
  assert.equal(audio.paused, false);
  assert.equal(audio.currentTime, 10);
  await engine.setPaused('music', true); await engine.setPaused('music', false);
  await wait(220);
  assert.equal(audio.paused, false);
});

test('loop boundary overlaps a prepared stream and releases the old voice', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.loadLayer('weather', 'loop', 0.5, 0);
  const old = mixer.getAudio('weather'); old.duration = 0.4; old.currentTime = 0.31;
  await wait(120);
  const next = mixer.getAudio('weather');
  assert.notEqual(next, old);
  assert.equal(next.loop, true);
  await wait(120);
  assert.equal(old.src, '');
});

test('interrupted gain envelopes retarget from current gain and equal-power pairs preserve power', () => {
  const context = new Context(); const input = new Param(); const output = new Param();
  const incoming = new GainEnvelope(context, input, 0); const outgoing = new GainEnvelope(context, output, 1);
  incoming.fade(1, 3, true); outgoing.fade(0, 3, true);
  context.currentTime = 1.5;
  assert.ok(Math.abs(incoming.value ** 2 + outgoing.value ** 2 - 1) < 1e-6);
  const audible = incoming.value;
  incoming.fade(0, 0.2);
  assert.equal(input.events.at(-2)[1], audible);
});

test('legacy playlist advancement keeps latest volume and stops retrying failed tracks', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.loadMusicPlaylist([{ url: 'one', name: 'One' }, { url: 'two', name: 'Two' }, { url: 'three', name: 'Three' }], 0.5, false);
  Audio.blocked.add('two');
  const advance = engine.playNextTrack();
  engine.setVolume('music', 0.2);
  Audio.instances.find(audio => audio.src === 'two').release();
  await advance;
  assert.equal(mixer.channels.get('music').volume, 0.2);
  assert.equal(engine.music.getSnapshot().volume, 0.2);
  const current = mixer.getAudio('music');
  Audio.failures.add('three');
  await assert.rejects(engine.music.selectTrack('three'), /load failure/);
  assert.equal(mixer.getAudio('music'), current);
  assert.equal(engine.getCurrentTrackInfo().name, 'Two');
});

test('rapid off/on reuses the fading stream without a duplicate source or late cleanup', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.scenes.applyScene(scene('mix', [ambience(1)]), 0);
  const original = mixer.getAudio('ambience:1');
  await engine.scenes.applyScene(scene('mix', [ambience(1, false)]), 0.05);
  await engine.scenes.applyScene(scene('mix', [ambience(1)]), 0.02);
  assert.equal(mixer.getAudio('ambience:1'), original);
  await wait(70);
  assert.equal(original.paused, false);
  assert.equal(original.src, 'sound-1');
});

test('one-shot concurrency is bounded and ended streams release their channels', async t => {
  const { engine, mixer, context } = await engineFixture(t);
  await Promise.all(Array.from({ length: 12 }, (_, i) => engine.playOneShot(`shot-${i}`)));
  await wait(20);
  assert.equal(mixer.oneShots.active.size, 10);
  for (const source of context.sources) source.onended?.();
  assert.equal(mixer.oneShots.active.size, 0);
  assert.ok(context.sources.every(source => source.disconnected));
});

test('live volume changes during a prepared scene survive commit and appear in active snapshot', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.scenes.applyScene(scene('mix', [ambience(1)]), 0);
  Audio.blocked.add('sound-2');
  const pending = engine.scenes.applyScene(scene('mix', [ambience(1), ambience(2)]), 0);
  engine.scenes.setAmbienceVolume('mix', 1, 20);
  Audio.instances.find(audio => audio.src === 'sound-2').release();
  await pending;
  assert.equal(mixer.getVolume('ambience:1'), 0.2);
  assert.equal(engine.scenes.getActiveScene().ambiences[0].volume, 20);
});

const mood = (id, urls) => ({ id, name: id, tracks: urls.map(url => ({ id: url, name: url, url })) });

test('prepared mood and scene changes leave the active music queue untouched', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('calm', ['a', 'b', 'c']), 0, false, 0.35);
  const playing = mixer.getAudio('music');
  music.prepareMood(mood('battle', ['d', 'e']));
  assert.equal(music.getSnapshot().mood.id, 'calm');
  assert.deepEqual(music.getSnapshot().upcoming.map(track => track.id), ['b', 'c']);
  await engine.scenes.applyScene(scene('forest', [ambience(1)]), 0);
  assert.equal(mixer.getAudio('music'), playing);
  assert.equal(music.getSnapshot().preparedMood.id, 'battle');
  music.cancelPrepared();
  assert.equal(mixer.getAudio('music'), playing);
  assert.equal(music.getSnapshot().preparedMood, null);
});

test('selecting an upcoming track skips earlier entries and reshuffle preserves current audio', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('mix', ['a', 'b', 'c', 'd']), 0, false);
  await music.selectTrack('c');
  assert.equal(music.getSnapshot().current.id, 'c');
  assert.deepEqual(music.getSnapshot().upcoming.map(track => track.id), ['d']);
  await music.next();
  const playing = mixer.getAudio('music'); playing.currentTime = 7;
  const upcoming = music.getSnapshot().upcoming.map(track => track.id).sort();
  music.reshuffleUpcoming();
  assert.equal(mixer.getAudio('music'), playing);
  assert.equal(playing.currentTime, 7);
  assert.deepEqual(music.getSnapshot().upcoming.map(track => track.id).sort(), upcoming);
  assert.notEqual(music.getSnapshot().upcoming[0].id, 'd');
  await assert.rejects(music.selectTrack('missing'), /not in the upcoming/);
});

test('preloads upcoming audio silently and advances before ended exactly once', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('mix', ['a', 'b', 'c']), 0.1, false);
  const old = mixer.getAudio('music'); old.duration = 0.4; old.currentTime = 0.05;
  music.tick(); await wait(0);
  const preloaded = Audio.instances.find(audio => audio.src === 'b');
  assert.ok(preloaded);
  assert.equal(preloaded.paused, true);
  assert.equal(mixer.getAudio('music'), old);
  old.currentTime = 0.31;
  music.tick(); music.tick();
  old.dispatchEvent(new Event('ended'));
  await wait(0);
  assert.equal(mixer.getAudio('music'), preloaded);
  assert.equal(music.getSnapshot().current.id, 'b');
  assert.equal(music.getSnapshot().playedCount, 2);
  assert.equal(old.paused, false);
  await wait(120);
  assert.equal(old.src, '');
});

test('unknown duration uses ended fallback and one-song moods restart instead of reusing position', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('solo', ['solo']), 0, false);
  const old = mixer.getAudio('music'); old.duration = NaN; old.currentTime = 12;
  music.tick(); await wait(0);
  old.ended = true; old.dispatchEvent(new Event('ended'));
  await wait(0);
  assert.notEqual(mixer.getAudio('music'), old);
  assert.equal(mixer.getAudio('music').currentTime, 0);
  assert.equal(music.getSnapshot().current.id, 'solo');
  assert.equal(music.getSnapshot().playedCount, 2);
});

test('new cycles avoid immediate repeats and contain the full catalogue', async t => {
  const { engine } = await engineFixture(t);
  const music = engine.music;
  music.random = () => 0;
  await music.applyMood(mood('shuffle', ['a', 'b', 'c']), 0, true);
  for (let i = 0; i < 8; i++) {
    const previous = music.getSnapshot().current.id;
    await music.next();
    assert.notEqual(music.getSnapshot().current.id, previous);
    assert.equal(new Set(music.getSnapshot().upcoming.map(track => track.id)).size, music.getSnapshot().upcoming.length);
  }
  assert.equal(music.getSnapshot().upcoming.length, 3);
  assert.deepEqual(music.getSnapshot().upcoming.map(track => track.id).sort(), ['a', 'b', 'c']);
});

test('failed new moods preserve playback, all-track failure is bounded and automatic retries stop', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('old', ['good', 'later']), 0, false);
  const old = mixer.getAudio('music');
  Audio.failures.add('bad-1'); Audio.failures.add('bad-2');
  await assert.rejects(music.applyMood(mood('bad', ['bad-1', 'bad-2']), 0, false), /No playable tracks/);
  assert.equal(mixer.getAudio('music'), old);
  assert.equal(music.getSnapshot().mood.id, 'old');
  Audio.failures.add('good'); Audio.failures.add('later');
  mixer.onError = () => {};
  old.ended = true; old.dispatchEvent(new Event('ended'));
  await wait(0);
  const count = Audio.instances.length;
  for (let i = 0; i < 10; i++) music.tick();
  await wait(0);
  assert.equal(Audio.instances.length, count);
  assert.match(music.getSnapshot().error, /No playable next song/);
  assert.equal(music.getSnapshot().current.id, 'good');
});

test('automatic advancement skips an unplayable candidate and stays at the selected volume', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('mixed', ['a', 'bad', 'c']), 0.1, false, 0.6);
  music.setVolume(0.22);
  Audio.failures.add('bad');
  music.tick(); await wait(0);
  const old = mixer.getAudio('music'); old.duration = 0.4; old.currentTime = 0.31;
  music.tick(); await wait(0);
  assert.equal(music.getSnapshot().current.id, 'c');
  assert.equal(mixer.getVolume('music'), 0.22);
  assert.equal(music.getSnapshot().volume, 0.22);
});

test('pause blocks automatic advancement and applying a mood while paused stays silent', async t => {
  const { engine, mixer } = await engineFixture(t);
  const music = engine.music;
  await music.setPaused(true);
  await music.applyMood(mood('mix', ['a', 'b']), 0.1, false);
  const old = mixer.getAudio('music'); old.duration = 0.4; old.currentTime = 0.39;
  assert.equal(old.paused, true);
  music.tick(); await wait(0);
  assert.equal(music.getSnapshot().current.id, 'a');
  await music.setPaused(false);
  assert.equal(old.paused, false);
  music.tick(); await wait(0);
  assert.equal(music.getSnapshot().current.id, 'b');
});

test('newer mood wins over a delayed request and old preload is disposed on reshuffle/stop', async t => {
  const { engine, mixer, context } = await engineFixture(t);
  const music = engine.music;
  await music.applyMood(mood('old', ['a', 'b']), 0, false);
  music.tick(); await wait(0);
  const standby = Audio.instances.find(audio => audio.src === 'b');
  music.reshuffleUpcoming();
  assert.equal(standby.src, '');
  Audio.blocked.add('slow');
  const slowRequest = music.applyMood(mood('slow-mood', ['slow']), 0);
  const slow = Audio.instances.find(audio => audio.src === 'slow');
  await music.applyMood(mood('latest', ['latest']), 0);
  assert.equal(await slowRequest, false); slow.release();
  assert.equal(music.getSnapshot().current.id, 'latest');
  await music.stop(0); await wait(10);
  assert.equal(music.getSnapshot().current, null);
  assert.equal(mixer.getAudio('music'), undefined);
  assert.ok(context.sources.every(source => source.disconnected));
});


test('media stays attached during playback and disposal removes every element', async t => {
  const { engine, mixer } = await engineFixture(t);
  await engine.music.applyMood(mood('mix', ['a', 'b']), 0, false);
  engine.music.tick(); await wait(0);
  assert.equal(mixer.getAudio('music').parentNode, body);
  assert.equal(body.children.size, 2);
  await engine.dispose();
  assert.equal(body.children.size, 0);
});

test('one-shots share decoded buffers, retain their attack and retry failed downloads only on demand', async t => {
  const { engine, context } = await engineFixture(t);
  const previousFetch = globalThis.fetch; let fetches = 0, decodes = 0;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = async () => { fetches++; return { ok: false, status: 404 }; };
  await assert.rejects(engine.playOneShot('missing'), /HTTP 404/);
  assert.equal(fetches, 1);
  globalThis.fetch = async () => { fetches++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; };
  context.decodeAudioData = async () => { decodes++; return { length: 48000, numberOfChannels: 2 }; };
  await Promise.all([engine.playOneShot('effect', .3), engine.playOneShot('effect', .4)]);
  await engine.playOneShot('effect', .5);
  assert.equal(fetches, 2); assert.equal(decodes, 1);
  assert.equal(context.sources.at(-1).destination.gain.value, .5);
});

test('disposing during one-shot loading cannot start late audio', async t => {
  const { engine, context } = await engineFixture(t);
  const previousFetch = globalThis.fetch; let release;
  t.after(() => { globalThis.fetch = previousFetch; });
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  const pending = engine.playOneShot('slow');
  const rejected = assert.rejects(pending, /disposed/);
  await engine.dispose();
  release({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  await rejected;
  assert.equal(context.sources.length, 0);
});
