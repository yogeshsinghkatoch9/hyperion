/* ═══ HYPERION — Color Tools Routes ═══ */
const express = require('express');
const router = express.Router();
const clr = require('../services/colorTools');

// POST /api/colors/convert — Convert between color formats
router.post('/convert', (req, res) => {
  try {
    const { color } = req.body;
    if (!color) return res.status(400).json({ error: 'Color is required' });
    const parsed = clr.parseColor(color);
    const hsl = clr.hexToHsl(parsed.hex);
    res.json({ hex: parsed.hex, rgb: { r: parsed.r, g: parsed.g, b: parsed.b }, hsl });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/colors/contrast — Get contrast ratio between two colors
router.post('/contrast', (req, res) => {
  try {
    const { color1, color2, level } = req.body;
    if (!color1 || !color2) return res.status(400).json({ error: 'Two colors are required' });
    const c1 = clr.parseColor(color1).hex;
    const c2 = clr.parseColor(color2).hex;
    res.json(clr.meetsWCAG(c1, c2, level || 'AA'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/colors/palette — Generate palette from base color
router.post('/palette', (req, res) => {
  try {
    const { color, type } = req.body;
    if (!color) return res.status(400).json({ error: 'Base color is required' });
    const base = clr.parseColor(color).hex;
    res.json(clr.generatePalette(base, type || 'complementary'));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/colors/shades — Generate shades
router.post('/shades', (req, res) => {
  try {
    const { color, steps } = req.body;
    if (!color) return res.status(400).json({ error: 'Color is required' });
    const base = clr.parseColor(color).hex;
    res.json({ base, shades: clr.generateShades(base, steps || 9) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/colors/parse — Parse any color format
router.post('/parse', (req, res) => {
  try {
    const { color } = req.body;
    if (!color) return res.status(400).json({ error: 'Color is required' });
    res.json(clr.parseColor(color));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/colors — List saved palettes
router.get('/', (req, res) => {
  res.json(clr.getPalettes(req.app.locals.db));
});

// POST /api/colors — Save palette
router.post('/', (req, res) => {
  try {
    res.json(clr.savePalette(req.app.locals.db, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/colors/:id — Get saved palette
router.get('/:id', (req, res) => {
  try {
    res.json(clr.getPalette(req.app.locals.db, req.params.id));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// DELETE /api/colors/:id — Delete palette
router.delete('/:id', (req, res) => {
  try {
    clr.deletePalette(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
