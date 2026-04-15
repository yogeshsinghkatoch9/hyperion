const express = require('express');
const router = express.Router();
const pm = require('../services/processManager');

// GET /api/processes/list — List processes
router.get('/list', (req, res) => {
  try {
    res.json(pm.listProcesses(req.query.sort || 'cpu'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/processes/search — Search processes
router.get('/search', (req, res) => {
  res.json(pm.searchProcesses(req.query.q || ''));
});

// POST /api/processes/kill — Kill process
router.post('/kill', (req, res) => {
  try {
    res.json(pm.killProcess(req.body.pid, req.body.signal));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/processes/kill-port — Kill by port
router.post('/kill-port', (req, res) => {
  try {
    res.json(pm.killByPort(req.body.port));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/processes/ports — Listening ports
router.get('/ports', (req, res) => {
  res.json(pm.getListeningPorts());
});

// GET /api/processes/port/:port — Process on port
router.get('/port/:port', (req, res) => {
  try {
    res.json(pm.getProcessOnPort(parseInt(req.params.port)));
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// POST /api/processes/scan — Port scan
router.post('/scan', async (req, res) => {
  try {
    const { host, startPort, endPort, timeout } = req.body;
    const results = await pm.scanPortRange(host || '127.0.0.1', startPort || 1, endPort || 1024, timeout);
    res.json(results);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET /api/processes/resources — System resources
router.get('/resources', (req, res) => {
  res.json(pm.getSystemResources());
});

// GET /api/processes/top — Top resource consumers
router.get('/top', (req, res) => {
  try {
    res.json(pm.getTopProcesses(parseInt(req.query.count) || 10, req.query.sort || 'cpu'));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/processes/tree/:pid — Process tree
router.get('/tree/:pid', (req, res) => {
  try {
    res.json({ tree: pm.getProcessTree(req.params.pid) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
