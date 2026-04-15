const express = require('express');
const router = express.Router();
const ws = require('../services/wsClient');

// GET /api/ws/connections — List saved connections
router.get('/connections', (req, res) => {
  res.json(ws.getConnections(req.app.locals.db));
});

// POST /api/ws/connections — Save a connection
router.post('/connections', (req, res) => {
  try {
    const result = ws.saveConnection(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/ws/connections/:id — Update connection
router.put('/connections/:id', (req, res) => {
  try {
    const result = ws.updateConnection(req.app.locals.db, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/ws/connections/:id — Delete connection
router.delete('/connections/:id', (req, res) => {
  try {
    ws.deleteConnection(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/ws/history/:connId — Get message history
router.get('/history/:connId', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json(ws.getMessageHistory(req.app.locals.db, req.params.connId, limit));
});

// DELETE /api/ws/history/:connId — Clear message history
router.delete('/history/:connId', (req, res) => {
  ws.clearMessageHistory(req.app.locals.db, req.params.connId);
  res.json({ ok: true });
});

// GET /api/ws/stats — Connection statistics
router.get('/stats', (req, res) => {
  res.json(ws.getStats(req.app.locals.db));
});

// POST /api/ws/validate — Validate WebSocket URL
router.post('/validate', (req, res) => {
  const { url } = req.body;
  const normalized = ws.normalizeWsUrl(url);
  res.json({
    valid: ws.isValidWsUrl(normalized),
    normalized,
  });
});

module.exports = router;
