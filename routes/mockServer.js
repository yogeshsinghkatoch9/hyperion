const express = require('express');
const router = express.Router();
const mock = require('../services/mockServer');

// GET /api/mock/endpoints — List all endpoints
router.get('/endpoints', (req, res) => {
  res.json(mock.getEndpoints(req.app.locals.db));
});

// POST /api/mock/endpoints — Create endpoint
router.post('/endpoints', (req, res) => {
  try {
    const result = mock.createEndpoint(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/mock/endpoints/:id — Update endpoint
router.put('/endpoints/:id', (req, res) => {
  try {
    const result = mock.updateEndpoint(req.app.locals.db, req.params.id, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/mock/endpoints/:id — Delete endpoint
router.delete('/endpoints/:id', (req, res) => {
  try {
    mock.deleteEndpoint(req.app.locals.db, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// POST /api/mock/start — Start mock server
router.post('/start', async (req, res) => {
  try {
    const result = await mock.startServer(req.app.locals.db, req.body.port);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/mock/stop — Stop mock server
router.post('/stop', async (req, res) => {
  try {
    const result = await mock.stopServer();
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/mock/status — Server status
router.get('/status', (req, res) => {
  res.json(mock.getServerStatus());
});

// GET /api/mock/log — Request log
router.get('/log', (req, res) => {
  res.json(mock.getRequestLog());
});

module.exports = router;
