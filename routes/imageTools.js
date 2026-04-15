/* ═══ HYPERION — Image Tools Routes ═══ */
const express = require('express');
const router = express.Router();
const img = require('../services/imageTools');

// POST /api/images/info — Get image info from base64 data
router.post('/info', (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Image data is required' });
    const buffer = Buffer.from(data, 'base64');
    res.json(img.getImageInfo(buffer));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/images/to-base64 — Convert image data to base64 data URI
router.post('/to-base64', (req, res) => {
  try {
    const { data, mimeType } = req.body;
    if (!data) return res.status(400).json({ error: 'Image data is required' });
    const buffer = Buffer.from(data, 'base64');
    const dataUri = img.toBase64Url(buffer, mimeType);
    res.json({ dataUri, size: buffer.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/images/from-base64 — Parse data URI back to info
router.post('/from-base64', (req, res) => {
  try {
    const { dataUri } = req.body;
    if (!dataUri) return res.status(400).json({ error: 'Data URI is required' });
    const { buffer, mimeType } = img.fromBase64(dataUri);
    res.json({ size: buffer.length, mimeType, data: buffer.toString('base64') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/images/placeholder — Generate SVG placeholder
router.post('/placeholder', (req, res) => {
  try {
    const { width, height, color, text } = req.body;
    const svg = img.generatePlaceholder(width, height, color, text);
    res.json({ svg, dataUri: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/images/validate — Validate image data
router.post('/validate', (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: 'Image data is required' });
    const buffer = Buffer.from(data, 'base64');
    res.json(img.validateImage(buffer));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
