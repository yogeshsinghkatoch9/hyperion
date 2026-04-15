'use strict';
const express = require('express');
const router = express.Router();
const metricsService = require('../services/metricsService');
const { metricsCache } = require('../services/responseCache');
const metricsHistory = require('../services/metricsHistory');

// GET / — JSON metrics (cached 30s)
router.get('/', metricsCache.middleware(30000), (req, res) => {
  res.json(metricsService.getMetrics());
});

// GET /prometheus — Prometheus text format
router.get('/prometheus', (req, res) => {
  const m = metricsService.getMetrics();
  const lines = [];

  lines.push('# HELP http_requests_total Total HTTP requests');
  lines.push('# TYPE http_requests_total counter');
  for (const [method, byStatus] of Object.entries(groupByMethodStatus(m))) {
    for (const [status, count] of Object.entries(byStatus)) {
      lines.push(`http_requests_total{method="${method}",status="${status}"} ${count}`);
    }
  }
  // Fallback: total by method and status separately
  if (!Object.keys(m.requests.byMethod).length) {
    lines.push('http_requests_total 0');
  }

  lines.push('# HELP http_request_duration_ms HTTP request duration');
  lines.push('# TYPE http_request_duration_ms gauge');
  lines.push(`http_request_duration_avg_ms ${m.requests.avgDuration}`);
  lines.push(`http_request_duration_p95_ms ${m.requests.p95Duration}`);
  lines.push(`http_request_duration_p99_ms ${m.requests.p99Duration}`);

  lines.push('# HELP hyperion_memory_usage_bytes Process memory usage');
  lines.push('# TYPE hyperion_memory_usage_bytes gauge');
  lines.push(`hyperion_memory_usage_bytes ${m.system.memUsage}`);

  lines.push('# HELP hyperion_uptime_seconds Process uptime');
  lines.push('# TYPE hyperion_uptime_seconds gauge');
  lines.push(`hyperion_uptime_seconds ${m.system.uptime}`);

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

// GET /history — metrics history for charts
router.get('/history', (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const db = req.app.locals.db;
    res.json(metricsHistory.getHistory(db, hours));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /history/stats — metrics snapshot stats
router.get('/history/stats', (req, res) => {
  try {
    const db = req.app.locals.db;
    res.json(metricsHistory.getStats(db));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /history/snapshot — take manual snapshot
router.post('/history/snapshot', (req, res) => {
  try {
    metricsHistory.takeSnapshot();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Build method+status cross-tabulation from flat maps
function groupByMethodStatus(m) {
  // We only have byMethod and byStatus separately; emit each method with total
  const result = {};
  for (const [method, count] of Object.entries(m.requests.byMethod)) {
    result[method] = {};
    for (const [status, sCount] of Object.entries(m.requests.byStatus)) {
      result[method][status] = sCount;
    }
  }
  return result;
}

module.exports = router;
