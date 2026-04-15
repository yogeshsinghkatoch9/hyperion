const express = require('express');
const router = express.Router();
const notes = require('../services/notes');
const { validate, sanitize } = require('../services/validation');

// GET /api/notes — List all notes
router.get('/', (req, res) => {
  res.json(notes.getNotes(req.app.locals.db));
});

// POST /api/notes — Create note
router.post('/',
  sanitize(['title', 'content']),
  validate({ title: { type: 'string', required: true, min: 1, max: 200 }, content: { type: 'string' } }),
  (req, res) => {
  try {
    const result = notes.createNote(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/notes/:id — Update note
router.put('/:id',
  sanitize(['title', 'content']),
  validate({ title: { type: 'string', required: true, min: 1, max: 200 }, content: { type: 'string' } }),
  (req, res) => {
  try {
    const result = notes.updateNote(req.app.locals.db, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/notes/:id — Delete note
router.delete('/:id', (req, res) => {
  try {
    notes.deleteNote(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// PUT /api/notes/:id/pin — Toggle pin
router.put('/:id/pin', (req, res) => {
  try {
    const result = notes.togglePin(req.app.locals.db, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/notes/search — Search notes
router.get('/search', (req, res) => {
  const results = notes.searchNotes(req.app.locals.db, req.query.q);
  res.json(results);
});

module.exports = router;
