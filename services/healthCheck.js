'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');

function runChecks(db) {
  const checks = {};
  let overallStatus = 'healthy';

  // Database check
  try {
    const start = Date.now();
    db.prepare('SELECT 1').get();
    const latency = Date.now() - start;
    checks.database = { status: latency > 100 ? 'warning' : 'ok', latency };
  } catch (e) {
    checks.database = { status: 'error', error: e.message };
    overallStatus = 'degraded';
  }

  // API latency (from recent metrics_snapshots)
  try {
    const snap = db.prepare(
      `SELECT avg_duration, p95_duration FROM metrics_snapshots ORDER BY created_at DESC LIMIT 1`
    ).get();
    if (snap) {
      const status = snap.avg_duration > 500 ? 'warning' : snap.avg_duration > 1000 ? 'error' : 'ok';
      checks.api = { status, avgLatency: Math.round(snap.avg_duration), p95: Math.round(snap.p95_duration) };
      if (status !== 'ok' && overallStatus === 'healthy') overallStatus = 'degraded';
    } else {
      checks.api = { status: 'ok', avgLatency: 0, p95: 0 };
    }
  } catch {
    checks.api = { status: 'ok', avgLatency: 0, p95: 0 };
  }

  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const memStatus = memPercent > 95 ? 'error' : memPercent > 85 ? 'warning' : 'ok';
  checks.memory = { status: memStatus, percent: memPercent, total: totalMem, free: freeMem, used: totalMem - freeMem };
  if (memStatus === 'error') overallStatus = 'degraded';

  // CPU
  const loadAvg = os.loadavg();
  const cpuCount = os.cpus().length;
  const loadPercent = Math.round((loadAvg[0] / cpuCount) * 100);
  const cpuStatus = loadPercent > 90 ? 'error' : loadPercent > 70 ? 'warning' : 'ok';
  checks.cpu = { status: cpuStatus, loadPercent, loadAvg, cores: cpuCount };
  if (cpuStatus === 'error') overallStatus = 'degraded';

  // Disk
  try {
    const dataDir = path.join(__dirname, '..', 'data');
    try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
    fs.accessSync(dataDir, fs.constants.W_OK);
    // Get disk stats via df (macOS/linux)
    const { execSync } = require('child_process');
    const raw = execSync(`df -k "${path.join(__dirname, '..')}" 2>/dev/null | tail -1`, { encoding: 'utf8', timeout: 3000 }).trim();
    const parts = raw.split(/\s+/);
    const usedPercent = parseInt(parts[4]) || 0;
    const diskStatus = usedPercent > 90 ? 'error' : usedPercent > 80 ? 'warning' : 'ok';
    checks.disk = { status: diskStatus, usedPercent, total: parseInt(parts[1]) * 1024, used: parseInt(parts[2]) * 1024, available: parseInt(parts[3]) * 1024 };
    if (diskStatus === 'error') overallStatus = 'degraded';
  } catch {
    checks.disk = { status: 'ok', usedPercent: 0 };
  }

  // Services
  const services = { database: checks.database.status !== 'error' };
  checks.services = { status: services.database ? 'ok' : 'error', details: services };

  return {
    status: overallStatus,
    checks,
    uptime: process.uptime(),
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    timestamp: Date.now(),
  };
}

function getHealthTrend(db, hours = 24) {
  try {
    const rows = db.prepare(
      `SELECT id, total_requests, avg_duration, p95_duration, mem_usage, cpu_usage, created_at
       FROM metrics_snapshots
       WHERE created_at >= datetime('now', '-${Math.min(720, Math.max(1, hours))} hours')
       ORDER BY created_at`
    ).all();
    return rows;
  } catch {
    return [];
  }
}

function evaluateAlerts(db, snapshot) {
  const rules = getAlertRules(db);
  const alerts = [];

  for (const rule of rules) {
    let value;
    switch (rule.metric) {
      case 'cpu':           value = snapshot?.checks?.cpu?.loadPercent; break;
      case 'memory_percent': value = snapshot?.checks?.memory?.percent; break;
      case 'disk_percent':   value = snapshot?.checks?.disk?.usedPercent; break;
      case 'avg_latency':    value = snapshot?.checks?.api?.avgLatency; break;
      default: continue;
    }
    if (value === undefined || value === null) continue;

    let triggered = false;
    switch (rule.operator) {
      case 'gt': triggered = value > rule.value; break;
      case 'gte': triggered = value >= rule.value; break;
      case 'lt': triggered = value < rule.value; break;
      case 'lte': triggered = value <= rule.value; break;
      case 'eq': triggered = value === rule.value; break;
    }

    if (triggered) {
      alerts.push({
        metric: rule.metric,
        level: rule.level || 'warning',
        message: `${rule.metric} is ${value} (threshold: ${rule.operator} ${rule.value})`,
        value,
        rule,
      });
    }
  }
  return alerts;
}

const DEFAULT_ALERT_RULES = [
  { metric: 'cpu', operator: 'gt', value: 80, level: 'warning' },
  { metric: 'memory_percent', operator: 'gt', value: 90, level: 'critical' },
  { metric: 'disk_percent', operator: 'gt', value: 85, level: 'warning' },
  { metric: 'avg_latency', operator: 'gt', value: 500, level: 'warning' },
];

function getAlertRules(db) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE user_id = 'system' AND key = 'health_alert_rules'").get();
    if (row) return JSON.parse(row.value);
  } catch {}
  return DEFAULT_ALERT_RULES;
}

function saveAlertRules(db, rules) {
  if (!Array.isArray(rules)) return DEFAULT_ALERT_RULES;
  const json = JSON.stringify(rules);
  db.prepare(
    "INSERT INTO settings (user_id, key, value, updated_at) VALUES ('system', 'health_alert_rules', ?, datetime('now')) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(json);
  return rules;
}

module.exports = {
  runChecks,
  getHealthTrend,
  evaluateAlerts,
  getAlertRules,
  saveAlertRules,
  DEFAULT_ALERT_RULES,
};
