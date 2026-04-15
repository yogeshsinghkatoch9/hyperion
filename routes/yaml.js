/* ═══ HYPERION — YAML Tools Routes ═══ */
const express = require('express');
const router = express.Router();
const yaml = require('../services/yamlTools');

// POST /to-json — Convert YAML text to JSON string
router.post('/to-json', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: yaml.yamlToJson(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /to-yaml — Convert JSON text to YAML string
router.post('/to-yaml', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: yaml.jsonToYaml(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /validate — Check if text is valid YAML
router.post('/validate', (req, res) => {
  try {
    const { text } = req.body;
    const result = yaml.validate(text);
    res.json({ valid: result.valid, error: result.error });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /parse — Parse YAML text into a JS object
router.post('/parse', (req, res) => {
  try {
    const { text } = req.body;
    res.json({ result: yaml.parse(text) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /stringify — Stringify a JS object to YAML
router.post('/stringify', (req, res) => {
  try {
    const { data } = req.body;
    res.json({ result: yaml.stringify(data) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
