const express = require('express');
const router = express.Router();
const md = require('../services/markdownEditor');

// GET /api/md/notes — List all notes
router.get('/notes', (req, res) => {
  res.json(md.getNotes(req.app.locals.db));
});

// POST /api/md/notes — Create note
router.post('/notes', (req, res) => {
  try {
    const result = md.createNote(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/md/notes/:id — Update note
router.put('/notes/:id', (req, res) => {
  try {
    const result = md.updateNote(req.app.locals.db, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/md/notes/:id — Delete note
router.delete('/notes/:id', (req, res) => {
  try {
    md.deleteNote(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/md/search — Search notes
router.get('/search', (req, res) => {
  const results = md.searchNotes(req.app.locals.db, req.query.q);
  res.json(results);
});

// POST /api/md/stats — Get document stats
router.post('/stats', (req, res) => {
  const { content } = req.body;
  res.json(md.getDocStats(content || ''));
});

// POST /api/md/export/html — Export markdown as HTML
router.post('/export/html', (req, res) => {
  const { content, title } = req.body;
  const html = md.exportHtml(content || '', title);
  res.type('html').send(html);
});

module.exports = router;
