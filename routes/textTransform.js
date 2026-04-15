const express = require('express');
const router = express.Router();
const tt = require('../services/textTransform');

// GET /api/text/list — Available transforms
router.get('/list', (req, res) => {
  res.json(tt.listTransforms());
});

// POST /api/text/transform — Apply single transform
router.post('/transform', (req, res) => {
  try {
    const { name, text, options } = req.body;
    if (!name) return res.status(400).json({ error: 'Transform name is required' });
    const result = tt.applyTransform(name, text, options);
    res.json({ result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/text/batch — Apply multiple transforms in sequence
router.post('/batch', (req, res) => {
  try {
    const { transforms, text } = req.body;
    if (!transforms || !Array.isArray(transforms)) return res.status(400).json({ error: 'Transforms array is required' });
    let result = text || '';
    const steps = [];
    for (const t of transforms) {
      const name = typeof t === 'string' ? t : t.name;
      const options = typeof t === 'object' ? t.options : undefined;
      result = tt.applyTransform(name, result, options);
      steps.push({ name, result: typeof result === 'string' ? result : String(result) });
    }
    res.json({ result, steps });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
