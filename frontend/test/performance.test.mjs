import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const directory = mkdtempSync(join(tmpdir(), 'ambience-performance-'));
await build({ stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {PerformanceMixer} from './src/mixer/PerformanceMixer'; export const render = mixer => renderToStaticMarkup(React.createElement(PerformanceMixer, {mixer}));`, resolveDir: dirname(dirname(fileURLToPath(import.meta.url))), loader: 'tsx' }, bundle: true, jsx: 'automatic', platform: 'node', format: 'esm', banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }, outfile: join(directory, 'screen.mjs') });
const { render } = await import(pathToFileURL(join(directory, 'screen.mjs')));
after(() => rmSync(directory, { recursive: true, force: true }));
const scene = { id: 'forest', label: 'Forest', icon: 'Trees', environment: { id: '1', name: 'Forest bed', volume: .5, url: '/1' }, environmentVolume: 50,
  ambiences: Array.from({ length: 20 }, (_, i) => ({ audioId: i + 2, volume: 40, enabled: true, audio: { id: String(i + 2), name: `Ambience ${i}`, url: `/${i + 2}`, volume: .4 } })),
  oneshots: Array.from({ length: 12 }, (_, i) => ({ id: String(i + 50), name: `Effect ${i}`, url: `/shot${i}`, icon: 'Zap' })) };
const fixture = () => ({ drafts: { preparedId: 'forest', drafts: { forest: scene }, saved: { forest: scene } }, active: structuredClone(scene), music: { mood: { id: 'calm', name: 'Calm' }, preparedMood: null, current: { id: 'a', name: 'Playing song' }, upcoming: Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: `Song ${i}`, url: `/song${i}` })), volume: .5, paused: false, error: null }, tags: [], loading: false, preparingMood: false, applying: false, muted: false, error: '' });
test('home has fill volume controls, a full queue and every active one-shot', () => {
  const html = render(fixture());
  assert.doesNotMatch(html, /<select|type="range"|type="text"|Delete scene|Scene name|Music continues/);
  assert.match(html, /All sounds/); assert.match(html, /Choose one-shots/); assert.match(html, /Upcoming songs/);
  assert.match(html, /Ambience 3/); assert.doesNotMatch(html, /Ambience 4/);
  assert.match(html, /Effect 11/);
  assert.match(html, /Song 29/);
});
test('preparing another scene keeps active one-shots and current music on the home screen', () => {
  const mixer = fixture(); mixer.drafts = { ...mixer.drafts, preparedId: 'cave', drafts: { cave: { ...scene, id: 'cave', label: 'Cave', oneshots: [{ id: '99', name: 'Prepared-only shot', url: '/99' }] } } };
  const html = render(mixer);
  assert.match(html, /Cave/); assert.match(html, /Active: Forest/); assert.match(html, /Playing song/); assert.match(html, /Effect 0/);
  assert.doesNotMatch(html, /Prepared-only shot/); assert.match(html, /Apply.*scene/);
});

test('one-shot-only edits show a save action and unsaved scene marker without Apply', () => {
  const mixer = fixture();
  mixer.drafts.drafts = { forest: { ...scene, oneshots: [] } };
  const html = render(mixer);
  assert.match(html, /Save changes/);
  assert.match(html, /Forest \(unsaved changes\)/);
  assert.doesNotMatch(html, />Apply scene</);
});
test('background fill keeps its full travel while exposing a maximum of twenty percent', () => {
  const html = render(fixture());
  assert.match(html, /aria-label="Forest bed volume"[^>]*aria-valuemax="20"[^>]*aria-valuenow="10"/);
  assert.match(html, /aria-label="Ambience 0 volume"[^>]*aria-valuemax="20"[^>]*aria-valuenow="8"/);
  assert.match(html, /aria-label="Music volume"[^>]*aria-valuemax="100"/);
});
