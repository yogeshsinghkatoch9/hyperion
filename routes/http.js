const express = require('express');
const router = express.Router();
const httpClient = require('../services/httpClient');

// POST /api/http/send — Send an HTTP request
router.post('/send', async (req, res) => {
  try {
    const { method, url, headers, body, envId } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Resolve environment variables
    let envVars = {};
    if (envId) {
      const envs = httpClient.getEnvironments(req.app.locals.db);
      const env = envs.find(e => e.id === envId);
      if (env) envVars = env.variables;
    }

    const config = httpClient.interpolateRequest({ method, url, headers: headers || {}, body }, envVars);
    const result = await httpClient.sendRequest(config);

    // Save to history
    httpClient.addHistory(req.app.locals.db, {
      method: config.method,
      url: config.url,
      status: result.status,
      statusText: result.statusText,
      time: result.time,
      size: result.size,
      request: { method: config.method, url: config.url, headers: config.headers, body: config.body },
      responseHeaders: result.headers,
      body: result.body,
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/http/curl/parse — Parse cURL command
router.post('/curl/parse', (req, res) => {
  try {
    const result = httpClient.parseCurl(req.body.curl);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/http/curl/export — Export as cURL
router.post('/curl/export', (req, res) => {
  const curl = httpClient.toCurl(req.body);
  res.json({ curl });
});

// ── Collections ──
router.get('/collections', (req, res) => {
  res.json(httpClient.getCollections(req.app.locals.db));
});

router.get('/collections/:id', (req, res) => {
  const coll = httpClient.getCollection(req.app.locals.db, req.params.id);
  if (!coll) return res.status(404).json({ error: 'Not found' });
  res.json(coll);
});

router.post('/collections', (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const coll = httpClient.createCollection(req.app.locals.db, name, description);
  res.json(coll);
});

router.delete('/collections/:id', (req, res) => {
  httpClient.deleteCollection(req.app.locals.db, req.params.id);
  res.json({ ok: true });
});

router.post('/collections/:id/requests', (req, res) => {
  try {
    const entry = httpClient.addToCollection(req.app.locals.db, req.params.id, req.body);
    res.json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/collections/:id/requests/:reqId', (req, res) => {
  try {
    httpClient.removeFromCollection(req.app.locals.db, req.params.id, req.params.reqId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── History ──
router.get('/history', (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  res.json(httpClient.getHistory(req.app.locals.db, limit));
});

router.get('/history/:id', (req, res) => {
  const entry = httpClient.getHistoryEntry(req.app.locals.db, req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json(entry);
});

router.delete('/history', (req, res) => {
  httpClient.clearHistory(req.app.locals.db);
  res.json({ ok: true });
});

// ── Environments ──
router.get('/environments', (req, res) => {
  res.json(httpClient.getEnvironments(req.app.locals.db));
});

router.post('/environments', (req, res) => {
  const { name, variables } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const env = httpClient.createEnvironment(req.app.locals.db, name, variables);
  res.json(env);
});

router.put('/environments/:id', (req, res) => {
  const { name, variables } = req.body;
  httpClient.updateEnvironment(req.app.locals.db, req.params.id, name, variables);
  res.json({ ok: true });
});

router.delete('/environments/:id', (req, res) => {
  httpClient.deleteEnvironment(req.app.locals.db, req.params.id);
  res.json({ ok: true });
});

// ── Common headers ──
router.get('/common-headers', (req, res) => {
  res.json(httpClient.COMMON_HEADERS);
});

module.exports = router;
