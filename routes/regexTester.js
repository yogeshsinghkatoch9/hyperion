/* ═══ HYPERION — Regex Tester Routes ═══ */
const express = require('express');
const router = express.Router();
const rx = require('../services/regexTester');

// POST /api/regex/test — Test regex against text
router.post('/test', (req, res) => {
  try {
    const { pattern, flags, text } = req.body;
    if (!pattern) return res.status(400).json({ error: 'Pattern is required' });
    res.json(rx.testRegex(pattern, flags || '', text || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/regex/replace — Find & replace
router.post('/replace', (req, res) => {
  try {
    const { pattern, flags, text, replacement } = req.body;
    if (!pattern) return res.status(400).json({ error: 'Pattern is required' });
    res.json(rx.replaceRegex(pattern, flags || '', text || '', replacement || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/regex/split — Split text by regex
router.post('/split', (req, res) => {
  try {
    const { pattern, flags, text } = req.body;
    if (!pattern) return res.status(400).json({ error: 'Pattern is required' });
    res.json(rx.splitRegex(pattern, flags || '', text || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/regex/explain — Explain regex tokens
router.post('/explain', (req, res) => {
  try {
    const { pattern } = req.body;
    if (!pattern) return res.status(400).json({ error: 'Pattern is required' });
    res.json(rx.explainRegex(pattern));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/regex/validate — Validate regex
router.post('/validate', (req, res) => {
  const { pattern, flags } = req.body;
  res.json(rx.validateRegex(pattern || '', flags || ''));
});

// GET /api/regex/common — Get common patterns
router.get('/common', (req, res) => {
  res.json(rx.getCommonPatterns());
});

// GET /api/regex — List saved patterns
router.get('/', (req, res) => {
  res.json(rx.getPatterns(req.app.locals.db));
});

// POST /api/regex — Save pattern
router.post('/', (req, res) => {
  try {
    res.json(rx.savePattern(req.app.locals.db, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/regex/:id — Get saved pattern
router.get('/:id', (req, res) => {
  try {
    res.json(rx.getPattern(req.app.locals.db, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /api/regex/:id — Delete saved pattern
router.delete('/:id', (req, res) => {
  try {
    rx.deletePattern(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
