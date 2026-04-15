const express = require('express');
const router = express.Router();
const lt = require('../services/loadTester');

// POST /api/load/validate — Validate test config
router.post('/validate', (req, res) => {
  res.json(lt.validateConfig(req.body));
});

// POST /api/load/run — Execute load test
router.post('/run', async (req, res) => {
  try {
    const { results, summary } = await lt.runLoadTest(req.body);
    const saved = lt.saveTest(req.app.locals.db, req.body, summary);
    res.json({ ...saved, summary, resultCount: results.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/load — List past tests
router.get('/', (req, res) => {
  res.json(lt.getTests(req.app.locals.db));
});

// GET /api/load/:id — Single test
router.get('/:id', (req, res) => {
  try {
    res.json(lt.getTest(req.app.locals.db, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /api/load/:id — Delete test
router.delete('/:id', (req, res) => {
  try {
    lt.deleteTest(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
