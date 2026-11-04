import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
for (const port of [3001, 5174]) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error(`Port ${port} is busy. Stop the existing preview first.`)));
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}
const root = process.cwd();
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop());
const env = { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3001',
  DB_PATH: path.join(root, '.local/data/ambience.db'),
  AUDIO_DIR: path.join(root, '.local/audio') };
const backend = spawn(process.execPath, ['--watch', 'src/index.js'], { cwd: path.join(root, 'backend'), env, stdio: 'inherit' });
children.push(backend);
backend.on('exit', code => { if (!stopping) stop(code || 1); });
backend.on('error', error => { console.error(error); stop(1); });
let ready = false;
for (let attempt = 0; attempt < 60 && !stopping; attempt++) {
  try { const result = await fetch('http://127.0.0.1:3001/api/health'); if (result.ok) { ready = true; break; } } catch {}
  await new Promise(resolve => setTimeout(resolve, 250));
}
if (!ready) { console.error('Backend did not become ready.'); stop(1); }
else {
  const frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], {
    cwd: path.join(root, 'frontend'), env: { ...env, API_PROXY_TARGET: 'http://127.0.0.1:3001' }, stdio: 'inherit'
  });
  children.push(frontend);
  frontend.on('exit', code => { if (!stopping) stop(code || 1); });
  frontend.on('error', error => { console.error(error); stop(1); });
  console.log('Local preview: http://127.0.0.1:5174 — Ctrl+C stops both servers.');
}
