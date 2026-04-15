const express = require('express');
const router = express.Router();
const cron = require('../services/cron');

// GET /api/cron/list — List crontab entries
router.get('/list', (req, res) => {
  res.json(cron.listCrontab());
});

// POST /api/cron/add — Add entry
router.post('/add', (req, res) => {
  try {
    const { schedule, command } = req.body;
    res.json(cron.addCrontabEntry(schedule, command));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// PUT /api/cron/update — Update entry
router.put('/update', (req, res) => {
  try {
    const { index, schedule, command } = req.body;
    res.json(cron.updateCrontabEntry(index, schedule, command));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE /api/cron/:index — Remove entry
router.delete('/:index', (req, res) => {
  try {
    res.json(cron.removeCrontabEntry(parseInt(req.params.index)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/cron/validate — Validate expression
router.post('/validate', (req, res) => {
  res.json(cron.validateCronExpression(req.body.expression || ''));
});

// POST /api/cron/describe — Human-readable description
router.post('/describe', (req, res) => {
  res.json({ description: cron.describeCronExpression(req.body.expression || '') });
});

// POST /api/cron/next-runs — Calculate next runs
router.post('/next-runs', (req, res) => {
  try {
    const runs = cron.getNextRuns(req.body.expression || '', req.body.count || 5);
    res.json({ runs });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/cron/presets — Common presets
router.get('/presets', (req, res) => {
  res.json(cron.getPresets());
});

// GET /api/cron/history — Execution history
router.get('/history', (req, res) => {
  res.json(cron.getCronHistory(req.app.locals.db, parseInt(req.query.limit) || 50));
});

module.exports = router;
