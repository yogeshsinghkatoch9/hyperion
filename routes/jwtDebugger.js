/* ═══ HYPERION — JWT Debugger Routes ═══ */
const express = require('express');
const router = express.Router();
const jwt = require('../services/jwtDebugger');

// POST /api/jwt/decode — Decode JWT (no verification)
router.post('/decode', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    res.json(jwt.decode(token));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/jwt/encode — Create JWT
router.post('/encode', (req, res) => {
  try {
    const { payload, secret, options } = req.body;
    if (!payload) return res.status(400).json({ error: 'Payload is required' });
    if (!secret) return res.status(400).json({ error: 'Secret is required' });
    const token = jwt.encode(payload, secret, options || {});
    res.json({ token });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/jwt/verify — Verify JWT
router.post('/verify', (req, res) => {
  try {
    const { token, secret } = req.body;
    if (!token) return res.status(400).json({ error: 'Token is required' });
    if (!secret) return res.status(400).json({ error: 'Secret is required' });
    res.json(jwt.verify(token, secret));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/jwt/algorithms — List supported algorithms
router.get('/algorithms', (req, res) => {
  res.json(jwt.getAlgorithms());
});

module.exports = router;
