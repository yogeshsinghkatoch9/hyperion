const express = require('express');
const router = express.Router();
const bm = require('../services/bookmarks');
const { validate, sanitize } = require('../services/validation');

// GET /api/bookmarks — List all bookmarks
router.get('/', (req, res) => {
  res.json(bm.getBookmarks(req.app.locals.db));
});

// POST /api/bookmarks — Create bookmark
router.post('/',
  sanitize(['url', 'title']),
  validate({ url: { type: 'string', required: true, min: 1 }, title: { type: 'string' } }),
  (req, res) => {
  try {
    const result = bm.createBookmark(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/bookmarks/:id — Update bookmark
router.put('/:id', (req, res) => {
  try {
    const result = bm.updateBookmark(req.app.locals.db, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/bookmarks/:id — Delete bookmark
router.delete('/:id', (req, res) => {
  try {
    bm.deleteBookmark(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/bookmarks/tags — Tag listing with counts
router.get('/tags', (req, res) => {
  res.json(bm.getTags(req.app.locals.db));
});

// GET /api/bookmarks/search — Search bookmarks
router.get('/search', (req, res) => {
  const results = bm.searchBookmarks(req.app.locals.db, req.query.q, req.query.tag);
  res.json(results);
});

// POST /api/bookmarks/import — Import bookmarks
router.post('/import', (req, res) => {
  try {
    const result = bm.importBookmarks(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/bookmarks/export — Export bookmarks
router.get('/export', (req, res) => {
  res.json(bm.exportBookmarks(req.app.locals.db));
});

module.exports = router;
