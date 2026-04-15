const express = require('express');
const router = express.Router();
const auditLog = require('../services/auditLog');

// GET / — query audit logs with filters
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const { action, resource, userId, from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 50, 500);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const result = auditLog.query(db, { userId, action, resource, from, to, limit, offset });
    res.json({ logs: result.rows, total: result.total, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /stats — counts grouped by action + top 10 resources
router.get('/stats', (req, res) => {
  const db = req.app.locals.db;
  try {
    const byAction = db.prepare(
      'SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action ORDER BY count DESC'
    ).all();

    const topResources = db.prepare(
      'SELECT resource, COUNT(*) as count FROM audit_logs WHERE resource IS NOT NULL GROUP BY resource ORDER BY count DESC LIMIT 10'
    ).all();

    res.json({ byAction, topResources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /timeline — activity timeline data
router.get('/timeline', (req, res) => {
  const db = req.app.locals.db;
  const { from, to, bucketMinutes } = req.query;
  try {
    const data = auditLog.getTimeline(db, { from, to, bucketMinutes: parseInt(bucketMinutes) || 60 });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /top-users — top users by action count
router.get('/top-users', (req, res) => {
  const db = req.app.locals.db;
  const { from, to } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  try {
    const data = auditLog.getTopUsers(db, { from, to, limit });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /suspicious — suspicious activity alerts
router.get('/suspicious', (req, res) => {
  const db = req.app.locals.db;
  try {
    const alerts = auditLog.getSuspiciousActivity(db);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /export — CSV download
router.get('/export', (req, res) => {
  const db = req.app.locals.db;
  const { action, resource, userId, from, to } = req.query;
  try {
    const csv = auditLog.exportCsv(db, { userId, action, resource, from, to });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
