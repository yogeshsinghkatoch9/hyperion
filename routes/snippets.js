const express = require('express');
const router = express.Router();
const snippets = require('../services/snippets');
const { validate, sanitize } = require('../services/validation');

// GET /api/snippets — List snippets
router.get('/', (req, res) => {
  const { language, tag, search, limit, offset } = req.query;
  res.json(snippets.listSnippets(req.app.locals.db, { language, tag, search, limit: parseInt(limit) || 100, offset: parseInt(offset) || 0 }));
});

// GET /api/snippets/tags — All tags
router.get('/tags', (req, res) => {
  res.json(snippets.getAllTags(req.app.locals.db));
});

// GET /api/snippets/stats — Statistics
router.get('/stats', (req, res) => {
  res.json(snippets.getStats(req.app.locals.db));
});

// GET /api/snippets/languages — Supported languages
router.get('/languages', (req, res) => {
  res.json(snippets.LANGUAGES);
});

// GET /api/snippets/export — Export all
router.get('/export', (req, res) => {
  const format = req.query.format || 'json';
  const data = snippets.exportSnippets(req.app.locals.db, format);
  res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=snippets.${format}`);
  res.send(data);
});

// POST /api/snippets/import — Import
router.post('/import', (req, res) => {
  try {
    res.json(snippets.importSnippets(req.app.locals.db, req.body));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/snippets/:id — Get one
router.get('/:id', (req, res) => {
  try { res.json(snippets.getSnippet(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

// POST /api/snippets — Create
router.post('/',
  sanitize(['title', 'code', 'language']),
  validate({ title: { type: 'string', required: true }, code: { type: 'string', required: true }, language: { type: 'string' } }),
  (req, res) => {
  try { res.json(snippets.createSnippet(req.app.locals.db, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/snippets/:id — Update
router.put('/:id', (req, res) => {
  try { res.json(snippets.updateSnippet(req.app.locals.db, req.params.id, req.body)); }
  catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/snippets/:id — Delete
router.delete('/:id', (req, res) => {
  try { res.json(snippets.deleteSnippet(req.app.locals.db, req.params.id)); }
  catch (e) { res.status(404).json({ error: e.message }); }
});

module.exports = router;
