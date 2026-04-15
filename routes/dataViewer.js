const express = require('express');
const router = express.Router();
const dv = require('../services/dataViewer');

// POST /api/data/parse — Parse data (auto-detect format)
router.post('/parse', (req, res) => {
  try {
    const { text, delimiter } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });
    const format = dv.detectFormat(text);
    const parsed = format === 'json' ? dv.parseJSON(text) : dv.parseCSV(text, delimiter);
    res.json({ format, ...parsed });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/data/filter — Filter rows
router.post('/filter', (req, res) => {
  const { rows, column, operator, value } = req.body;
  res.json(dv.filterRows(rows, column, operator, value));
});

// POST /api/data/sort — Sort rows
router.post('/sort', (req, res) => {
  const { rows, column, direction } = req.body;
  res.json(dv.sortRows(rows, column, direction));
});

// POST /api/data/aggregate — Aggregate column
router.post('/aggregate', (req, res) => {
  const { rows, column, fn } = req.body;
  res.json({ result: dv.aggregate(rows, column, fn) });
});

// GET /api/data — List saved data sets
router.get('/', (req, res) => {
  res.json(dv.getDataSets(req.app.locals.db));
});

// POST /api/data — Save data set
router.post('/', (req, res) => {
  try {
    const { name, content, format } = req.body;
    const result = dv.saveDataSet(req.app.locals.db, name, content, format);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/data/:id — Get data set
router.get('/:id', (req, res) => {
  try {
    res.json(dv.getDataSet(req.app.locals.db, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /api/data/:id — Delete data set
router.delete('/:id', (req, res) => {
  try {
    dv.deleteDataSet(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
