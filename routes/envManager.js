const express = require('express');
const router = express.Router();
const env = require('../services/envManager');

// POST /api/env/read — Read env file
router.post('/read', (req, res) => {
  try {
    const mask = req.body.maskSensitive !== false;
    res.json(env.readEnvFile(req.body.path, mask));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/write — Write env file
router.post('/write', (req, res) => {
  try {
    res.json(env.writeEnvFile(req.body.path, req.body.entries));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/set — Set single variable
router.post('/set', (req, res) => {
  try {
    res.json(env.setVariable(req.body.path, req.body.key, req.body.value));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/remove — Remove variable
router.post('/remove', (req, res) => {
  try {
    res.json(env.removeVariable(req.body.path, req.body.key));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/compare — Compare two files
router.post('/compare', (req, res) => {
  try {
    res.json(env.compareEnvFiles(req.body.file1, req.body.file2));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/validate — Validate env file
router.post('/validate', (req, res) => {
  try {
    res.json(env.validateEnvFile(req.body.path));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/discover — Find env files
router.post('/discover', (req, res) => {
  try {
    res.json(env.discoverEnvFiles(req.body.dir || '.', req.body.maxDepth || 3));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/env/template — Generate template
router.post('/template', (req, res) => {
  try {
    const entries = env.parseEnvFile(req.body.path);
    res.json({ template: env.generateTemplate(entries) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
