const express = require('express');
const router = express.Router();
const { runDiagnostics } = require('../services/doctor');

// Full diagnostic
router.get('/', async (req, res) => {
  const db = req.app.locals.db;
  const report = await runDiagnostics(db);
  res.json(report);
});

// Quick check (basic checks only)
router.get('/quick', async (req, res) => {
  const db = req.app.locals.db;
  const report = await runDiagnostics(db, { quick: true });
  res.json(report);
});

module.exports = router;
