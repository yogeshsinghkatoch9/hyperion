const express = require('express');
const router = express.Router();
const toolkit = require('../services/devToolkit');

// POST /api/toolkit/hash — Generate hash(es)
router.post('/hash', (req, res) => {
  const { input, algorithm } = req.body;
  if (!input && input !== '') return res.status(400).json({ error: 'Input required' });
  if (algorithm === 'all') {
    res.json(toolkit.generateAllHashes(input));
  } else {
    res.json({ hash: toolkit.generateHash(input, algorithm) });
  }
});

// POST /api/toolkit/base64/encode
router.post('/base64/encode', (req, res) => {
  res.json({ result: toolkit.base64Encode(req.body.input || '') });
});

// POST /api/toolkit/base64/decode
router.post('/base64/decode', (req, res) => {
  try {
    res.json({ result: toolkit.base64Decode(req.body.input || '') });
  } catch (err) {
    res.status(400).json({ error: 'Invalid base64 input' });
  }
});

// POST /api/toolkit/url/encode
router.post('/url/encode', (req, res) => {
  res.json({ result: toolkit.urlEncode(req.body.input || '') });
});

// POST /api/toolkit/url/decode
router.post('/url/decode', (req, res) => {
  try {
    res.json({ result: toolkit.urlDecode(req.body.input || '') });
  } catch (err) {
    res.status(400).json({ error: 'Invalid URL-encoded input' });
  }
});

// POST /api/toolkit/json/format
router.post('/json/format', (req, res) => {
  try {
    res.json({ result: toolkit.formatJson(req.body.input || '', req.body.indent) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/toolkit/json/minify
router.post('/json/minify', (req, res) => {
  try {
    res.json({ result: toolkit.minifyJson(req.body.input || '') });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/toolkit/json/validate
router.post('/json/validate', (req, res) => {
  res.json(toolkit.validateJson(req.body.input || ''));
});

// POST /api/toolkit/regex — Test regex
router.post('/regex', (req, res) => {
  const { pattern, flags, testString } = req.body;
  res.json(toolkit.testRegex(pattern || '', flags || '', testString || ''));
});

// POST /api/toolkit/diff — Text diff
router.post('/diff', (req, res) => {
  const { text1, text2 } = req.body;
  res.json(toolkit.textDiff(text1 || '', text2 || ''));
});

// POST /api/toolkit/timestamp — Convert timestamp
router.post('/timestamp', (req, res) => {
  try {
    const { timestamp, dateStr } = req.body;
    if (timestamp !== undefined) {
      res.json(toolkit.timestampToDate(parseInt(timestamp)));
    } else if (dateStr) {
      res.json(toolkit.dateToTimestamp(dateStr));
    } else {
      res.json(toolkit.nowTimestamp());
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/toolkit/uuid — Generate UUID
router.get('/uuid', (req, res) => {
  res.json({ uuid: toolkit.generateUUID() });
});

// POST /api/toolkit/jwt/decode — Decode JWT
router.post('/jwt/decode', (req, res) => {
  try {
    res.json(toolkit.decodeJwt(req.body.token || ''));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/toolkit/color — Color conversion
router.post('/color', (req, res) => {
  try {
    const { hex, r, g, b } = req.body;
    if (hex) {
      res.json(toolkit.hexToRgb(hex));
    } else if (r !== undefined) {
      res.json({ hex: toolkit.rgbToHex(parseInt(r), parseInt(g), parseInt(b)) });
    } else {
      res.status(400).json({ error: 'Provide hex or r,g,b' });
    }
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
