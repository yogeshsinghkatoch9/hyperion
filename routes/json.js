/* ═══ HYPERION — JSON Formatter Routes ═══ */
const express = require('express');
const router = express.Router();
const jsonFmt = require('../services/jsonFormatter');

// POST /format — Pretty-print JSON with optional indent
router.post('/format', (req, res) => {
  try {
    const { text, indent } = req.body;
    res.json({ result: jsonFmt.format(text, indent) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /minify — Minify JSON (remove whitespace)
router.post('/minify', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: jsonFmt.minify(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /validate — Check if text is valid JSON
router.post('/validate', (req, res) => {
  try {
    const { text } = req.body;
    const result = jsonFmt.validate(text);
    res.json({ valid: result.valid, error: result.error });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /sort-keys — Recursively sort all object keys
router.post('/sort-keys', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: jsonFmt.sortKeys(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /diff — Deep-diff two JSON values
router.post('/diff', (req, res) => {
  try {
    const { a, b } = req.body;
    res.json({ diffs: jsonFmt.diff(a, b) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /query — Traverse JSON with a dot-notation path
router.post('/query', (req, res) => {
  try {
    const { text, path } = req.body;
    const parsed = JSON.parse(text);
    res.json({ result: jsonFmt.query(parsed, path) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /flatten — Flatten nested JSON to dot-notation keys
router.post('/flatten', (req, res) => {
  try {
    const { text } = req.body;
    const parsed = JSON.parse(text);
    res.json({ result: jsonFmt.flatten(parsed) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /unflatten — Unflatten dot-notation keys back to nested JSON
router.post('/unflatten', (req, res) => {
  try {
    const { text } = req.body;
    const parsed = JSON.parse(text);
    res.json({ result: jsonFmt.unflatten(parsed) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /stats — Compute statistics about a JSON string
router.post('/stats', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ stats: jsonFmt.getStats(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
