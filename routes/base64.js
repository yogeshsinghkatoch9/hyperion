/* ═══ HYPERION — Base64 Routes ═══ */
const express = require('express');
const router = express.Router();
const b64 = require('../services/base64Tools');

// POST /encode — Encode text to Base64
router.post('/encode', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: b64.encode(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /decode — Decode Base64 to text
router.post('/decode', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: b64.decode(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /encode-url — Encode text to URL-safe Base64
router.post('/encode-url', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: b64.encodeUrl(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /decode-url — Decode URL-safe Base64 to text
router.post('/decode-url', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: b64.decodeUrl(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /validate — Check if text is valid Base64
router.post('/validate', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ valid: b64.isValid(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /encode-file — Encode buffer data to a data URI
router.post('/encode-file', (req, res) => {
  try {
    const { data, mime } = req.body;
    const buffer = Buffer.from(data, 'base64');
    res.json({ result: b64.encodeFile(buffer, mime) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
