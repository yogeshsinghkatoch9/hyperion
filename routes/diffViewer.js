/* ═══ HYPERION — Diff Viewer Routes ═══ */
const express = require('express');
const router = express.Router();
const diff = require('../services/diffViewer');

// POST /api/diff/compare — Compute diff between two texts
router.post('/compare', (req, res) => {
  try {
    const { textA, textB } = req.body;
    const result = diff.computeDiff(textA || '', textB || '');
    const stats = diff.getStats(result);
    res.json({ diff: result, stats });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/diff/unified — Get unified diff format
router.post('/unified', (req, res) => {
  try {
    const { textA, textB, contextLines } = req.body;
    const result = diff.computeDiff(textA || '', textB || '');
    const unified = diff.formatUnified(result, contextLines || 3);
    res.json({ unified });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/diff — List saved snapshots
router.get('/', (req, res) => {
  res.json(diff.getSnapshots(req.app.locals.db));
});

// POST /api/diff — Save snapshot
router.post('/', (req, res) => {
  try {
    const { name, textA, textB } = req.body;
    const result = diff.computeDiff(textA || '', textB || '');
    const stats = diff.getStats(result);
    res.json(diff.saveSnapshot(req.app.locals.db, { name, textA, textB, stats }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/diff/:id — Get snapshot
router.get('/:id', (req, res) => {
  try {
    res.json(diff.getSnapshot(req.app.locals.db, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /api/diff/:id — Delete snapshot
router.delete('/:id', (req, res) => {
  try {
    diff.deleteSnapshot(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
