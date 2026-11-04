import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const directory = mkdtempSync(join(tmpdir(), 'ambience-wakelock-'));
await build({ entryPoints: [join(dirname(dirname(fileURLToPath(import.meta.url))), 'src/mixer/wakeLockSession.ts')], bundle: true, platform: 'node', format: 'esm', outfile: join(directory, 'wake.mjs') });
const { startWakeLockSession } = await import(pathToFileURL(join(directory, 'wake.mjs')));
after(() => rmSync(directory, { recursive: true, force: true }));
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(request) {
  let visible = true, callback, status;
  const stop = startWakeLockSession({ request, visible: () => visible, status: message => { status = message; }, subscribe: listener => { callback = listener; return () => { callback = undefined; }; } });
  return { stop, state: () => status, visibility: value => { visible = value; callback?.(); } };
}
function lock() {
  let released = false, notify = () => {}, finish;
  return { release: () => { released = true; return new Promise(resolve => { finish = () => { notify(); resolve(); }; }); },
    addEventListener: (_, callback) => { notify = callback; }, finish: () => finish?.(), systemRelease: () => notify(), released: () => released };
}
test('quick hide/return acquires a replacement before old release completes without clearing it', async () => {
  const first = lock(), second = lock(); let requests = 0;
  const f = fixture(async () => ++requests === 1 ? first : second);
  await flush(); assert.equal(f.state(), 'Active');
  f.visibility(false); assert.ok(first.released());
  f.visibility(true); await flush(); assert.equal(requests, 2); assert.equal(f.state(), 'Active');
  first.finish(); await flush(); assert.equal(f.state(), 'Active');
  f.stop(); assert.ok(second.released()); second.finish();
});
test('a lock resolving after disable/unmount is released without reporting Active', async () => {
  let resolve; const acquired = lock();
  const f = fixture(() => new Promise(done => { resolve = done; }));
  f.stop(); resolve(acquired); await flush();
  assert.ok(acquired.released()); assert.notEqual(f.state(), 'Active'); acquired.finish();
});
test('late hidden acquisition is released; returning visible permits another request', async () => {
  let resolve; const acquired = lock(); let requests = 0;
  const f = fixture(() => { requests++; return new Promise(done => { resolve = done; }); });
  f.visibility(false); resolve(acquired); await flush(); assert.ok(acquired.released());
  assert.equal(f.state(), 'Waiting for visible screen'); acquired.finish();
  f.visibility(true); assert.equal(requests, 2); f.stop(); resolve(lock()); await flush();
});
test('denial and system release report actual status without endless retry', async () => {
  let requests = 0;
  const f = fixture(async () => { requests++; throw new Error('denied'); });
  await flush(); assert.match(f.state(), /declined/); assert.equal(requests, 1); f.stop();
  const acquired = lock(); const g = fixture(async () => acquired);
  await flush(); acquired.systemRelease(); assert.match(g.state(), /Released by browser/); g.stop();
});
