/* ═══ HYPERION — Hash Generator Routes ═══ */
const express = require('express');
const router = express.Router();
const hashGen = require('../services/hashGenerator');

// POST /generate — Hash text with optional algorithm
router.post('/generate', (req, res) => {
  try {
    const { text, algorithm } = req.body;
    const algo = algorithm || 'sha256';
    res.json({ hash: hashGen.hash(text, algo), algorithm: algo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /hmac — Generate HMAC for text with a key
router.post('/hmac', (req, res) => {
  try {
    const { text, key, algorithm } = req.body;
    const algo = algorithm || 'sha256';
    res.json({ hash: hashGen.hmac(text, key, algo), algorithm: algo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /compare — Compare text against a hash (tries all algorithms)
router.post('/compare', (req, res) => {
  try {
    const { text, hash } = req.body;
    const result = hashGen.compare(text, hash);
    res.json({ match: result.match, algorithm: result.algorithm });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /bcrypt — Hash text with bcrypt
router.post('/bcrypt', async (req, res) => {
  try {
    const { text, rounds } = req.body;
    const hash = await hashGen.bcryptHash(text, rounds);
    res.json({ hash });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /bcrypt-compare — Compare text against a bcrypt hash
router.post('/bcrypt-compare', async (req, res) => {
  try {
    const { text, hash } = req.body;
    const match = await hashGen.bcryptCompare(text, hash);
    res.json({ match });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /algorithms — List supported hash algorithms
router.get('/algorithms', (req, res) => {
  try {
    res.json({ algorithms: hashGen.getAlgorithms() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
