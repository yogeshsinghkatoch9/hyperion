const express = require('express');
const router = express.Router();
const cb = require('../services/clipboard');
const { validate, sanitize } = require('../services/validation');

// GET /api/clipboard/search — Search clips
router.get('/search', (req, res) => {
  res.json(cb.searchClips(req.app.locals.db, req.query.q));
});

// GET /api/clipboard/stats — Clip stats
router.get('/stats', (req, res) => {
  res.json(cb.getClipStats(req.app.locals.db));
});

// GET /api/clipboard — List clips
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(cb.getClips(req.app.locals.db, limit));
});

// POST /api/clipboard — Save clip
router.post('/',
  sanitize(['content']),
  validate({ content: { type: 'string', required: true, min: 1 } }),
  (req, res) => {
  try {
    const result = cb.saveClip(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/clipboard/:id — Update clip
router.put('/:id', (req, res) => {
  try {
    const result = cb.updateClip(req.app.locals.db, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/clipboard/old/:days — Clear old clips
router.delete('/old/:days', (req, res) => {
  try {
    const result = cb.clearOldClips(req.app.locals.db, parseInt(req.params.days));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/clipboard/:id — Delete clip
router.delete('/:id', (req, res) => {
  try {
    cb.deleteClip(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PUT /api/clipboard/:id/pin — Pin clip
router.put('/:id/pin', (req, res) => {
  try {
    const result = cb.pinClip(req.app.locals.db, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/clipboard/:id/pin — Unpin clip
router.delete('/:id/pin', (req, res) => {
  try {
    const result = cb.unpinClip(req.app.locals.db, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
