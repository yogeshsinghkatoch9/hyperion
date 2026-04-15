'use strict';
const crypto = require('crypto');

function track(db, { event, page, userId, metadata }) {
  const id = crypto.randomUUID();
  const meta = metadata ? JSON.stringify(metadata) : '{}';
  db.prepare(
    'INSERT INTO analytics_events (id, event, page, user_id, metadata) VALUES (?, ?, ?, ?, ?)'
  ).run(id, event, page || null, userId || null, meta);
  return id;
}

function getPageViews(db, { from, to, limit = 20, offset = 0 } = {}) {
  let where = 'WHERE page IS NOT NULL';
  const params = [];
  if (from) { where += ' AND created_at >= ?'; params.push(from); }
  if (to) { where += ' AND created_at <= ?'; params.push(to); }
  const rows = db.prepare(`SELECT page, COUNT(*) as views FROM analytics_events ${where} GROUP BY page ORDER BY views DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(DISTINCT page) as total FROM analytics_events ${where}`).get(...params);
  return { rows, total, limit, offset };
}

function getTopFeatures(db, { from, to, limit = 10, offset = 0 } = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (from) { where += ' AND created_at >= ?'; params.push(from); }
  if (to) { where += ' AND created_at <= ?'; params.push(to); }
  const rows = db.prepare(`SELECT event, COUNT(*) as count FROM analytics_events ${where} GROUP BY event ORDER BY count DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset);
  const { total } = db.prepare(`SELECT COUNT(DISTINCT event) as total FROM analytics_events ${where}`).get(...params);
  return { rows, total, limit, offset };
}

function getActivityTimeline(db, { from, to, bucketMinutes = 60 } = {}) {
  const bucketSec = bucketMinutes * 60;
  let sql = `SELECT
    strftime('%s', created_at) / ${bucketSec} * ${bucketSec} as bucket,
    COUNT(*) as count
    FROM analytics_events WHERE 1=1`;
  const params = [];
  if (from) { sql += ' AND created_at >= ?'; params.push(from); }
  if (to) { sql += ' AND created_at <= ?'; params.push(to); }
  sql += ' GROUP BY bucket ORDER BY bucket';
  const rows = db.prepare(sql).all(...params);
  return rows.map(r => ({
    timestamp: new Date(r.bucket * 1000).toISOString(),
    count: r.count,
  }));
}

function getStats(db) {
  const total = db.prepare('SELECT COUNT(*) as c FROM analytics_events').get().c;
  const uniqueUsers = db.prepare(
    'SELECT COUNT(DISTINCT user_id) as c FROM analytics_events WHERE user_id IS NOT NULL'
  ).get().c;
  const topPages = db.prepare(
    'SELECT page, COUNT(*) as views FROM analytics_events WHERE page IS NOT NULL GROUP BY page ORDER BY views DESC LIMIT 5'
  ).all();
  const topEvents = db.prepare(
    'SELECT event, COUNT(*) as count FROM analytics_events GROUP BY event ORDER BY count DESC LIMIT 5'
  ).all();
  return { total, uniqueUsers, topPages, topEvents };
}

module.exports = { track, getPageViews, getTopFeatures, getActivityTimeline, getStats };
