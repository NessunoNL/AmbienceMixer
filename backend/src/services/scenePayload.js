// The legacy UI writes *_id fields and camel-case volume fields (0–100).
// Ambience writes use { audioId, volume, enabled }; reads add audio metadata.
export class SceneValidationError extends Error {}
const invalid = message => { throw new SceneValidationError(message); };
const own = (value, key) => Object.hasOwn(value, key);

export function normalizeScenePayload(body, existing, db, id) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Expected a scene object');
  const text = (value, field) => {
    if (typeof value !== 'string' || !value.trim()) invalid(`${field} must be a non-empty string`);
    return value;
  };
  const volume = (value, field) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) invalid(`${field} must be between 0 and 100`);
    return value;
  };
  const reference = (value, category, nullable = true) => {
    if (value === null && nullable) return null;
    if (!Number.isSafeInteger(value) || value <= 0 || db.getAudioFileById(value)?.category !== category) invalid(`Invalid ${category} audio ID`);
    return value;
  };
  const scene = { ...existing, id: text(id, 'id') };
  for (const field of ['label', 'icon']) scene[field] = text(own(body, field) ? body[field] : existing?.[field], field);
  for (const category of ['environment', 'weather', 'music']) {
    const field = `${category}_id`;
    scene[field] = own(body, field) ? reference(body[field], category) : existing?.[field] ?? null;
    const input = `${category}Volume`;
    const column = `${category}_volume`;
    scene[column] = own(body, input) ? volume(body[input], input) : existing?.[column] ?? { environment: 70, weather: 45, music: 60 }[category];
  }
  if (own(body, 'oneshots')) {
    if (!Array.isArray(body.oneshots)) invalid('oneshots must be an array');
    const ids = body.oneshots.map(value => reference(value, 'oneshots', false));
    if (new Set(ids).size !== ids.length) invalid('Duplicate one-shot IDs');
    scene.oneshots = JSON.stringify(ids);
  } else scene.oneshots = existing?.oneshots ?? '[]';

  let ambiences = existing ? db.getSceneAmbiences(id) : [];
  if (own(body, 'ambiences')) {
    if (!Array.isArray(body.ambiences)) invalid('ambiences must be an array');
    ambiences = body.ambiences.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) invalid('Invalid ambience entry');
      const audioId = reference(entry.audioId, 'weather', false);
      if (own(entry, 'enabled') && typeof entry.enabled !== 'boolean') invalid('enabled must be a boolean');
      return { audioId, volume: volume(entry.volume, 'ambience volume'), enabled: entry.enabled ?? true };
    });
    if (new Set(ambiences.map(entry => entry.audioId)).size !== ambiences.length) invalid('Duplicate ambience IDs');
    // Give the legacy player a single enabled ambience, while retaining the full list.
    const first = ambiences.find(entry => entry.enabled);
    scene.weather_id = first?.audioId ?? null;
    scene.weather_volume = first?.volume ?? scene.weather_volume;
  } else if (scene.weather_id !== (existing?.weather_id ?? null)) {
    // Legacy weather edits replace only the legacy slot, never the other ambiences.
    const matching = ambiences.find(entry => entry.audioId === scene.weather_id);
    ambiences = ambiences.filter(entry => entry.audioId !== existing?.weather_id && entry.audioId !== scene.weather_id);
    if (scene.weather_id !== null) ambiences.unshift({ audioId: scene.weather_id, volume: scene.weather_volume, enabled: matching?.enabled ?? true });
  } else if (own(body, 'weatherVolume') && scene.weather_id !== null) {
    ambiences = ambiences.map(entry => entry.audioId === scene.weather_id ? { ...entry, volume: scene.weather_volume } : entry);
  }
  return { scene, ambiences };
}
