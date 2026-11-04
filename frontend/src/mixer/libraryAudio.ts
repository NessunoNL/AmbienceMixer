import { api } from '../services/api';
import type { AudioFile } from '../services/api';
import type { AudioLayer } from '../types';
export const audioLayer = (file: AudioFile): AudioLayer => ({ ...file, id: String(file.id), url: api.getAudioStreamUrl(file.id) });
