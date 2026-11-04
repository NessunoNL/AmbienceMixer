import { AudioEngine } from './audioEngine';
import { api } from './services/api';
import type { AudioFile } from './services/api';
import type { SceneAmbience } from './types';

// Vite development entry only; not imported by the production application.
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = element('status');
const selects = ['environment', 'first', 'second', 'shot'].map(id => element<HTMLSelectElement>(id));
let engine: AudioEngine | undefined;
let muted = false;
let paused = false;
let library: Awaited<ReturnType<typeof api.getAudioLibrary>>;
const report = (message: string) => { status.textContent = message; };
const run = (callback: () => Promise<void>) => { void callback().catch(error => report(String(error))); };
function getEngine() {
  if (!engine) {
    engine = new AudioEngine();
    engine.music.subscribe(renderMusic);
    engine.music.setVolume(Number(element<HTMLInputElement>('music-volume').value) / 100);
  }
  engine.mixer.onError = error => report(String(error));
  return engine;
}
function audio(file?: AudioFile) {
  return file ? { id: String(file.id), name: file.name, url: api.getAudioStreamUrl(file.id), volume: 0.35 } : undefined;
}
const selected = (index: number, files: AudioFile[]) => files.find(file => String(file.id) === selects[index].value);
api.getAudioLibrary().then(result => {
  library = result;
  for (const [index, files] of [result.environment, result.weather, result.weather, result.oneshots].entries()) {
    selects[index].add(new Option('None', ''));
    for (const file of files) selects[index].add(new Option(file.name, String(file.id)));
    if (files.length) selects[index].value = String(files[index === 2 && files.length > 1 ? 1 : 0].id);
  }
  report('Ready. Audio is stopped until a playback button is pressed.');
}).catch(error => report(String(error)));

element('apply').onclick = () => run(async () => {
  const player = getEngine(); await player.resume();
  const ambiences: SceneAmbience[] = [];
  for (const index of [1, 2]) {
    const file = selected(index, library.weather);
    if (file && !ambiences.some(entry => entry.audioId === file.id)) ambiences.push({ audioId: file.id,
      audio: audio(file)!, volume: index === 1 ? Number(element<HTMLInputElement>('volume').value) : 25,
      enabled: index !== 1 || element<HTMLInputElement>('enabled').checked });
  }
  const applied = await player.scenes.applyScene({ id: 'check', label: 'Check', icon: 'Cloud',
    environment: audio(selected(0, library.environment)), environmentVolume: 25, ambiences, oneshots: [] });
  report(applied ? 'Mix applied. Listen for continuous shared sounds and smooth entry/exit.' : 'Superseded.');
});
element<HTMLInputElement>('volume').oninput = event => {
  const file = selected(1, library.weather);
  if (file) engine?.scenes.setAmbienceVolume('check', file.id, Number((event.target as HTMLInputElement).value));
};
element('mute').onclick = () => { muted = !muted; getEngine().setMuted(muted); report(muted ? 'Master muted, including one-shots.' : 'Master unmuted.'); };
element('pause').onclick = () => run(async () => {
  const file = selected(1, library.weather);
  if (file) { paused = !paused; await getEngine().mixer.setPaused(`ambience:${file.id}`, paused); report(paused ? 'A paused after fade.' : 'A resumed.'); }
});
element('trigger').onclick = () => run(async () => {
  const file = selected(3, library.oneshots);
  if (file) { const player = getEngine(); await player.resume(); await player.playOneShot(api.getAudioStreamUrl(file.id), 0.35); report('One-shot triggered (silent if master muted).'); }
});
element('stop').onclick = () => run(async () => {
  const player = getEngine(); await player.resume();
  await player.scenes.applyScene({ id: 'empty', label: 'Empty', icon: 'Cloud', ambiences: [], oneshots: [] });
  report('Scene fading out.');
});
element('dispose').onclick = () => run(async () => { await engine?.dispose(); engine = undefined; muted = false; paused = false; report('Audio resources released.'); });
window.addEventListener('pagehide', () => { void engine?.dispose(); });


function renderMusic() {
  if (!engine) return;
  const state = engine.music.getSnapshot();
  element('music-state').textContent = JSON.stringify({ active: state.mood?.name, prepared: state.preparedMood?.name,
    current: state.current?.name, paused: state.paused, transitioning: state.transitioning, error: state.error }, null, 2);
  const queue = element('music-queue'); queue.replaceChildren();
  for (const track of state.upcoming) {
    const button = document.createElement('button'); button.textContent = track.name;
    button.onclick = () => run(async () => { await getEngine().music.selectTrack(track.id); });
    queue.append(button);
  }
}
api.getAllMusicTags().then(tags => {
  for (const tag of tags) element<HTMLSelectElement>('mood').add(new Option(tag.name, String(tag.id)));
}).catch(error => report(String(error)));
let moodRequest = 0;
element('prepare-mood').onclick = () => run(async () => {
  const request = ++moodRequest;
  const select = element<HTMLSelectElement>('mood');
  const id = select.value;
  const name = select.selectedOptions[0].textContent ?? 'Music';
  const files = id ? await api.getAudioFilesByTag(Number(id)) : library.music;
  if (request !== moodRequest) return;
  getEngine().music.prepareMood({ id: id || 'test-library', name, tracks: files.map(file => ({ id: String(file.id), name: file.name, url: api.getAudioStreamUrl(file.id) })) });
});
element('apply-mood').onclick = () => run(async () => { const player = getEngine(); await player.resume(); await player.music.applyPrepared(); });
element('cancel-mood').onclick = () => { moodRequest++; getEngine().music.cancelPrepared(); };
element('next-song').onclick = () => run(async () => { await getEngine().music.next(); });
element('pause-music').onclick = () => run(async () => { const player = getEngine(); await player.music.setPaused(!player.music.getSnapshot().paused); });
element('shuffle-music').onclick = () => { getEngine().music.reshuffleUpcoming(); };
element<HTMLInputElement>('music-volume').oninput = event => { getEngine().music.setVolume(Number((event.target as HTMLInputElement).value) / 100); };
element('near-end').onclick = () => {
  const audio = engine?.mixer.getAudio('music');
  if (audio && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, audio.duration - Math.min(2, audio.duration / 4));
};
