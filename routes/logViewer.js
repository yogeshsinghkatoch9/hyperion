const express = require('express');
const router = express.Router();
const logViewer = require('../services/logViewer');

// GET /api/logs/read — Read a log file
router.get('/read', (req, res) => {
  try {
    const { path: filePath, lines, search, level } = req.query;
    if (!filePath) return res.status(400).json({ error: 'File path required' });
    const result = logViewer.readLogFile(filePath, {
      lines: lines ? parseInt(lines) : 200,
      search,
      level,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/logs/search — Search in a log file
router.get('/search', (req, res) => {
  try {
    const { path: filePath, pattern, maxResults } = req.query;
    if (!filePath || !pattern) return res.status(400).json({ error: 'File path and pattern required' });
    const results = logViewer.searchInFile(filePath, pattern, {
      maxResults: maxResults ? parseInt(maxResults) : 100,
    });
    res.json(results);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/logs/discover — Find log files in a directory
router.get('/discover', (req, res) => {
  try {
    const dir = req.query.dir || process.env.HOME || '/';
    const files = logViewer.findLogFiles(dir);
    res.json(files);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/logs/common — Get common log directories
router.get('/common', (req, res) => {
  res.json(logViewer.getCommonLogPaths());
});

module.exports = router;
