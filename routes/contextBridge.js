/**
 * Context Bridge Routes — REST API for AI-ready server context
 * Auth is automatic via global middleware in server.js
 */
const express = require('express');
const router = express.Router();
const contextBridge = require('../services/contextBridge');

// GET / — Full JSON context (optional ?sections=system,docker,health)
router.get('/', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const opts = {};
    if (req.query.sections) {
      opts.sections = req.query.sections.split(',').map(s => s.trim());
    }
    const ctx = await contextBridge.generateContext(db, opts);
    res.json(ctx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /markdown — Full markdown (text/markdown)
router.get('/markdown', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const opts = {};
    if (req.query.sections) {
      opts.sections = req.query.sections.split(',').map(s => s.trim());
    }
    const ctx = await contextBridge.generateContext(db, opts);
    const md = contextBridge.formatAsMarkdown(ctx);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('X-Token-Estimate', String(contextBridge.estimateTokens(md)));
    res.send(md);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /compact — Short markdown (~500 tokens)
router.get('/compact', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const ctx = await contextBridge.generateContext(db, {});
    const compact = contextBridge.formatCompact(ctx);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('X-Token-Estimate', String(contextBridge.estimateTokens(compact)));
    res.send(compact);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /custom — Custom section selection + format
router.post('/custom', async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { sections, format } = req.body || {};
    const opts = {};
    if (sections && Array.isArray(sections)) {
      opts.sections = sections;
    }
    const ctx = await contextBridge.generateContext(db, opts);

    if (format === 'markdown') {
      const md = contextBridge.formatAsMarkdown(ctx);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('X-Token-Estimate', String(contextBridge.estimateTokens(md)));
      res.send(md);
    } else if (format === 'compact') {
      const compact = contextBridge.formatCompact(ctx);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('X-Token-Estimate', String(contextBridge.estimateTokens(compact)));
      res.send(compact);
    } else {
      res.json(ctx);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
