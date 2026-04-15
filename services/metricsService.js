'use strict';
const os = require('os');

const BUFFER_SIZE = 10000;
const durations = new Float64Array(BUFFER_SIZE);
let head = 0;
let count = 0;
let total = 0;
const byMethod = {};
const byStatus = {};
let durationSum = 0;

function recordRequest(method, path, statusCode, durationMs) {
  total++;
  byMethod[method] = (byMethod[method] || 0) + 1;
  byStatus[statusCode] = (byStatus[statusCode] || 0) + 1;
  durations[head] = durationMs;
  head = (head + 1) % BUFFER_SIZE;
  if (count < BUFFER_SIZE) count++;
  durationSum += durationMs;
}

function percentile(p) {
  if (count === 0) return 0;
  const sorted = Array.from(durations.subarray(0, count)).sort((a, b) => a - b);
  const idx = Math.min(Math.ceil(p / 100 * sorted.length) - 1, sorted.length - 1);
  return sorted[Math.max(idx, 0)];
}

function getMetrics() {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const idle = cpus.reduce((s, c) => s + c.times.idle, 0);
  const tot = cpus.reduce((s, c) => s + c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq, 0);
  return {
    requests: {
      total,
      byMethod: { ...byMethod },
      byStatus: { ...byStatus },
      avgDuration: total > 0 ? Math.round((durationSum / total) * 100) / 100 : 0,
      p95Duration: percentile(95),
      p99Duration: percentile(99),
    },
    system: {
      uptime: process.uptime(),
      memUsage: mem.rss,
      cpuUsage: tot > 0 ? Math.round((1 - idle / tot) * 10000) / 100 : 0,
    },
    timestamp: Date.now(),
  };
}

function middleware() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ns = Number(process.hrtime.bigint() - start);
      const ms = ns / 1e6;
      recordRequest(req.method, req.originalUrl || req.url, res.statusCode, ms);
    });
    next();
  };
}

function reset() {
  head = 0;
  count = 0;
  total = 0;
  durationSum = 0;
  durations.fill(0);
  for (const k in byMethod) delete byMethod[k];
  for (const k in byStatus) delete byStatus[k];
}

module.exports = { recordRequest, getMetrics, middleware, reset };
