/* ═══ HYPERION — UUID Tools Routes ═══ */
const express = require('express');
const router = express.Router();
const uuidTools = require('../services/uuidTools');

// GET /v4 — Generate a v4 UUID
router.get('/v4', (req, res) => {
  try {
    res.json({ uuid: uuidTools.v4() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /v1 — Generate a v1 UUID
router.get('/v1', (req, res) => {
  try {
    res.json({ uuid: uuidTools.v1() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /nil — Return the nil UUID
router.get('/nil', (req, res) => {
  try {
    res.json({ uuid: uuidTools.nil() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /validate — Validate a UUID and return its version
router.post('/validate', (req, res) => {
  try {
    const { uuid } = req.body;
    const valid = uuidTools.validate(uuid);
    res.json({ valid, version: valid ? uuidTools.version(uuid) : null });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /parse — Parse a UUID into its components
router.post('/parse', (req, res) => {
  try {
    const { uuid } = req.body;
    res.json({ parsed: uuidTools.parse(uuid) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /batch — Generate a batch of v4 UUIDs
router.get('/batch', (req, res) => {
  try {
    const count = Math.min(Math.max(parseInt(req.query.count, 10) || 5, 1), 100);
    res.json({ uuids: uuidTools.generateBatch(count) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
