const express = require('express');
const router = express.Router();
const vectorMemory = require('../services/vectorMemory');

// Search memory
router.get('/search', async (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.status(400).json({ error: 'Query parameter q required' });
  const results = await vectorMemory.search(q, parseInt(limit) || 3);
  res.json(results);
});

// Recent conversations
router.get('/recent', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(vectorMemory.getRecent(limit));
});

// Memory stats
router.get('/stats', (req, res) => {
  res.json(vectorMemory.getStats());
});

// Delete a memory entry
router.delete('/:id', (req, res) => {
  const deleted = vectorMemory.forget(req.params.id);
  res.json({ ok: deleted });
});

// Clear all memory
router.delete('/', (req, res) => {
  vectorMemory.clearAll();
  res.json({ ok: true });
});

module.exports = router;
