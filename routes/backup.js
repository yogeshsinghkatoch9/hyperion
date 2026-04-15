'use strict';
const express = require('express');
const router = express.Router();
const backup = require('../services/backupService');

// GET /api/backup — list backups + stats
router.get('/', (req, res) => {
  try {
    const backups = backup.listBackups();
    const stats = backup.getBackupStats();
    res.json({ backups, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup — create a new backup
router.post('/', (req, res) => {
  try {
    const result = backup.createBackup(req.app.locals.db);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/backup/restore — restore from a backup
router.post('/restore', (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });
  try {
    backup.validateFilename(filename);
    const result = backup.restoreBackup(filename, req.app.locals.db);
    res.json(result);
  } catch (err) {
    const code = err.message.includes('Invalid') || err.message.includes('not found') ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
});

// DELETE /api/backup/:filename — delete a backup
router.delete('/:filename', (req, res) => {
  const { filename } = req.params;
  try {
    backup.validateFilename(filename);
    const result = backup.deleteBackup(filename, req.app.locals.db);
    res.json(result);
  } catch (err) {
    const code = err.message.includes('Invalid') || err.message.includes('not found') ? 400 : 500;
    res.status(code).json({ error: err.message });
  }
});

// POST /api/backup/clean — run retention cleanup
router.post('/clean', (req, res) => {
  try {
    const { keepDaily, keepWeekly } = req.body || {};
    const result = backup.cleanOldBackups(keepDaily, keepWeekly);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
