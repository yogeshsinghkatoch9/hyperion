const express = require('express');
const router = express.Router();
const dep = require('../services/depAuditor');

// POST /api/deps/scan — Parse package.json
router.post('/scan', (req, res) => {
  try {
    const dir = req.body.dir || process.cwd();
    const result = dep.parsePackageJson(dir);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/deps/audit — Run npm audit
router.post('/audit', (req, res) => {
  try {
    const dir = req.body.dir || process.cwd();
    const auditResult = dep.runAudit(dir);
    const severities = dep.countSeverities(auditResult);
    const score = dep.calculateSecurityScore(severities);
    res.json({ severities, score, raw: auditResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/deps/outdated — Check outdated packages
router.post('/outdated', (req, res) => {
  try {
    const dir = req.body.dir || process.cwd();
    const result = dep.runOutdated(dir);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/deps/licenses — Extract licenses
router.post('/licenses', (req, res) => {
  try {
    const dir = req.body.dir || process.cwd();
    const result = dep.extractLicenses(dir);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/deps/score — Full security score
router.post('/score', (req, res) => {
  try {
    const dir = req.body.dir || process.cwd();
    const auditResult = dep.runAudit(dir);
    const severities = dep.countSeverities(auditResult);
    const score = dep.calculateSecurityScore(severities);
    const outdated = dep.runOutdated(dir);
    const outdatedCount = Object.keys(outdated).length;
    res.json({ score, severities, outdatedCount });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
