/* ═══ HYPERION — Cron Builder Routes ═══ */
const express = require('express');
const router = express.Router();
const cron = require('../services/cronBuilder');

// POST /api/cron-expr/parse — Parse cron expression
router.post('/parse', (req, res) => {
  try {
    const { expression } = req.body;
    if (!expression) return res.status(400).json({ error: 'Expression is required' });
    res.json(cron.parseCron(expression));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cron-expr/explain — Human-readable explanation
router.post('/explain', (req, res) => {
  try {
    const { expression } = req.body;
    if (!expression) return res.status(400).json({ error: 'Expression is required' });
    res.json({ expression, explanation: cron.explainCron(expression) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cron-expr/build — Build expression from parts
router.post('/build', (req, res) => {
  try {
    const expression = cron.buildCron(req.body);
    res.json({ expression, explanation: cron.explainCron(expression) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cron-expr/next-runs — Get next run times
router.post('/next-runs', (req, res) => {
  try {
    const { expression, count, fromDate } = req.body;
    if (!expression) return res.status(400).json({ error: 'Expression is required' });
    const runs = cron.getNextRuns(expression, count || 5, fromDate);
    res.json({ expression, runs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/cron-expr/validate — Validate expression
router.post('/validate', (req, res) => {
  const { expression } = req.body;
  res.json(cron.validateCron(expression || ''));
});

// GET /api/cron-expr/presets — Get built-in presets
router.get('/presets', (req, res) => {
  res.json(cron.getPresets());
});

// GET /api/cron-expr — List custom presets
router.get('/', (req, res) => {
  res.json(cron.getCustomPresets(req.app.locals.db));
});

// POST /api/cron-expr — Save custom preset
router.post('/', (req, res) => {
  try {
    res.json(cron.savePreset(req.app.locals.db, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/cron-expr/:id — Delete custom preset
router.delete('/:id', (req, res) => {
  try {
    cron.deletePreset(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
