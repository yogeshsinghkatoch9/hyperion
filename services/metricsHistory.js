/**
 * Metrics History — persist in-memory metrics to DB for historical trends
 */
'use strict';
const metricsService = require('./metricsService');

let _db = null;
let _interval = null;
const SNAPSHOT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_SNAPSHOTS = 8640; // ~30 days at 5min intervals

function start(db) {
  _db = db;
  if (_interval) clearInterval(_interval);
  _interval = setInterval(takeSnapshot, SNAPSHOT_INTERVAL);
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

function takeSnapshot() {
  if (!_db) return;
  try {
    const m = metricsService.getMetrics();
    _db.prepare(
      `INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      m.requests.total,
      m.requests.avgDuration,
      m.requests.p95Duration,
      m.requests.p99Duration,
      m.system.memUsage,
      m.system.cpuUsage,
      JSON.stringify(m.requests.byMethod),
      JSON.stringify(m.requests.byStatus)
    );

    // Prune old snapshots
    _db.prepare(`DELETE FROM metrics_snapshots WHERE id NOT IN (SELECT id FROM metrics_snapshots ORDER BY created_at DESC LIMIT ?)`).run(MAX_SNAPSHOTS);
  } catch {}
}

function getHistory(db, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return db.prepare(
    'SELECT * FROM metrics_snapshots WHERE created_at > ? ORDER BY created_at'
  ).all(since).map(r => ({
    ...r,
    by_method: JSON.parse(r.by_method || '{}'),
    by_status: JSON.parse(r.by_status || '{}'),
  }));
}

function getStats(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM metrics_snapshots').get()?.c || 0;
  const oldest = db.prepare('SELECT MIN(created_at) as t FROM metrics_snapshots').get()?.t;
  const newest = db.prepare('SELECT MAX(created_at) as t FROM metrics_snapshots').get()?.t;
  return { count, oldest, newest };
}

module.exports = { start, stop, takeSnapshot, getHistory, getStats, MAX_SNAPSHOTS, SNAPSHOT_INTERVAL };
