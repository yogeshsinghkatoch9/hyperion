const express = require('express');
const router = express.Router();
const monitor = require('../services/monitor');
const healthCheck = require('../services/healthCheck');

// GET /api/monitor/snapshot — Full system overview
router.get('/snapshot', (req, res) => {
  res.json(monitor.getFullSnapshot());
});

// GET /api/monitor/processes — Process list
router.get('/processes', (req, res) => {
  const q = req.query.q;
  const procs = q ? monitor.searchProcesses(q) : monitor.getProcesses();
  res.json(procs);
});

// GET /api/monitor/processes/tree — Process tree
router.get('/processes/tree', (req, res) => {
  res.json(monitor.getProcessTree());
});

// GET /api/monitor/processes/summary — Process summary stats
router.get('/processes/summary', (req, res) => {
  res.json(monitor.getProcessSummary());
});

// POST /api/monitor/processes/:pid/kill — Kill a process
router.post('/processes/:pid/kill', (req, res) => {
  try {
    const pid = parseInt(req.params.pid);
    const signal = req.body.signal || 'SIGTERM';
    const result = monitor.killProcess(pid, signal);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/monitor/network — Network connections
router.get('/network', (req, res) => {
  res.json(monitor.getNetworkConnections());
});

// GET /api/monitor/network/summary — Network summary
router.get('/network/summary', (req, res) => {
  res.json(monitor.getNetworkSummary());
});

// GET /api/monitor/ports — Listening ports
router.get('/ports', (req, res) => {
  res.json(monitor.getListeningPorts());
});

// POST /api/monitor/ports/scan — Port scanner
router.post('/ports/scan', async (req, res) => {
  try {
    const { host, range, timeout } = req.body;
    if (!host) return res.status(400).json({ error: 'Host required' });
    const result = await monitor.scanPorts(host, range || '1-1024', timeout || 1000);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/monitor/disk — Disk info
router.get('/disk', (req, res) => {
  res.json(monitor.getDiskInfo());
});

// GET /api/monitor/disk/usage — Directory disk usage
router.get('/disk/usage', (req, res) => {
  const dirPath = req.query.path;
  const depth = parseInt(req.query.depth) || 1;
  res.json(monitor.getDiskUsage(dirPath, depth));
});

// GET /api/monitor/disk/largest — Largest files
router.get('/disk/largest', (req, res) => {
  const dirPath = req.query.path;
  const count = Math.min(50, parseInt(req.query.count) || 20);
  res.json(monitor.getLargestFiles(dirPath, count));
});

// GET /api/monitor/alerts — Alert history
router.get('/alerts', (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit) || 50);
  res.json(monitor.getAlertHistory(req.app.locals.db, limit));
});

// POST /api/monitor/alerts/check — Trigger alert check
router.post('/alerts/check', (req, res) => {
  const alerts = monitor.checkAlerts(req.app.locals.db);
  res.json(alerts);
});

// DELETE /api/monitor/alerts — Clear alert history
router.delete('/alerts', (req, res) => {
  monitor.clearAlertHistory(req.app.locals.db);
  res.json({ ok: true });
});

// GET /api/monitor/alerts/config — Get alert thresholds
router.get('/alerts/config', (req, res) => {
  res.json(monitor.getAlertConfig());
});

// PUT /api/monitor/alerts/config — Set alert thresholds
router.put('/alerts/config', (req, res) => {
  const config = monitor.setAlertConfig(req.body);
  res.json(config);
});

// ═══ HEALTH DASHBOARD ═══

// GET /api/monitor/health — unified health status
router.get('/health', (req, res) => {
  try {
    const data = healthCheck.runChecks(req.app.locals.db);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monitor/health/trend — historical trend
router.get('/health/trend', (req, res) => {
  const hours = Math.min(720, parseInt(req.query.hours) || 24);
  try {
    const data = healthCheck.getHealthTrend(req.app.locals.db, hours);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monitor/health/alerts — evaluate current alerts
router.get('/health/alerts', (req, res) => {
  try {
    const snapshot = healthCheck.runChecks(req.app.locals.db);
    const alerts = healthCheck.evaluateAlerts(req.app.locals.db, snapshot);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monitor/alert-rules — get alert rules
router.get('/alert-rules', (req, res) => {
  try {
    const rules = healthCheck.getAlertRules(req.app.locals.db);
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/monitor/alert-rules — update alert rules
router.put('/alert-rules', (req, res) => {
  try {
    const rules = healthCheck.saveAlertRules(req.app.locals.db, req.body);
    res.json(rules);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
