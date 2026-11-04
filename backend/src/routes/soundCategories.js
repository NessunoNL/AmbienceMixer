import express from 'express';
import db from '../services/database.js';

const router = express.Router();
const validId = value => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
const nameFrom = body => typeof body?.name === 'string' ? body.name.trim() : '';
function failure(res, error) {
  if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Category name already exists' });
  console.error('Sound category operation failed:', error);
  return res.status(500).json({ error: 'Failed to save sound category' });
}

router.get('/', (req, res) => {
  try { res.json(db.getSoundCategories()); } catch (error) { failure(res, error); }
});
router.post('/', (req, res) => {
  const name = nameFrom(req.body);
  if (!name || name.length > 100) return res.status(400).json({ error: 'Name must contain 1–100 characters' });
  try { res.status(201).json({ success: true, category: db.createSoundCategory(name) }); }
  catch (error) { failure(res, error); }
});
router.param('id', (req, res, next, id) => {
  if (!validId(id)) return res.status(400).json({ error: 'Invalid category ID' });
  try {
    if (!db.getSoundCategory(Number(id))) return res.status(404).json({ error: 'Category not found' });
    next();
  } catch (error) { failure(res, error); }
});
router.put('/:id', (req, res) => {
  const name = nameFrom(req.body);
  if (!name || name.length > 100) return res.status(400).json({ error: 'Name must contain 1–100 characters' });
  try { res.json({ success: true, category: db.renameSoundCategory(Number(req.params.id), name) }); }
  catch (error) { failure(res, error); }
});
router.delete('/:id', (req, res) => {
  try {
    db.deleteSoundCategory(Number(req.params.id));
    res.json({ success: true, id: Number(req.params.id) });
  } catch (error) { failure(res, error); }
});

export function assignSoundCategory(req, res) {
  const { categoryId } = req.body ?? {};
  if (!validId(req.params.id) || (categoryId !== null && (!Number.isSafeInteger(categoryId) || categoryId <= 0))) {
    return res.status(400).json({ error: 'Expected an audio ID and a categoryId (positive integer or null)' });
  }
  try {
    const audio = db.getAudioFileById(Number(req.params.id));
    if (!audio) return res.status(404).json({ error: 'Audio file not found' });
    if (!['weather', 'oneshots'].includes(audio.category)) return res.status(400).json({ error: 'Only ambiences and one-shots can have sound categories' });
    if (categoryId !== null && !db.getSoundCategory(categoryId)) return res.status(404).json({ error: 'Category not found' });
    db.assignSoundCategory(audio.id, categoryId);
    res.json({ success: true, audioId: audio.id, categoryId });
  } catch (error) { failure(res, error); }
}

export default router;
