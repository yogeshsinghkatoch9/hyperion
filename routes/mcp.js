const express = require('express');
const router = express.Router();
const mcpServer = require('../services/mcpServer');

// MCP server status
router.get('/status', (req, res) => {
  res.json(mcpServer.getStatus());
});

// Get available MCP tools
router.get('/tools', (req, res) => {
  res.json(mcpServer.getTools());
});

// Toggle MCP server
router.put('/config', (req, res) => {
  const db = req.app.locals.db;
  const { enabled, port } = req.body;

  if (enabled) {
    mcpServer.start(db, port || 3334);
  } else {
    mcpServer.stop();
  }

  res.json({ ok: true, status: mcpServer.getStatus() });
});

module.exports = router;
