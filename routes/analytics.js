'use strict';
const express = require('express');
const router = express.Router();
const analytics = require('../services/analyticsService');
const { analyticsCache } = require('../services/responseCache');

// GET /views — page view counts
router.get('/views', (req, res) => {
  const db = req.app.locals.db;
  const { from, to, limit, offset } = req.query;
  res.json(analytics.getPageViews(db, {
    from, to,
    limit: Math.min(parseInt(limit) || 20, 200),
    offset: parseInt(offset) || 0,
  }));
});

// GET /features — top features/events
router.get('/features', (req, res) => {
  const db = req.app.locals.db;
  const { from, to, limit, offset } = req.query;
  res.json(analytics.getTopFeatures(db, {
    from, to,
    limit: Math.min(parseInt(limit) || 10, 200),
    offset: parseInt(offset) || 0,
  }));
});

// GET /timeline — activity timeline bucketed by hour
router.get('/timeline', (req, res) => {
  const db = req.app.locals.db;
  const { from, to, bucketMinutes } = req.query;
  res.json(analytics.getActivityTimeline(db, {
    from, to,
    bucketMinutes: bucketMinutes ? parseInt(bucketMinutes) : 60,
  }));
});

// GET /stats — overall stats (cached 5m)
router.get('/stats', analyticsCache.middleware(300000), (req, res) => {
  const db = req.app.locals.db;
  res.json(analytics.getStats(db));
});

// POST /track — track an event
router.post('/track', (req, res) => {
  const db = req.app.locals.db;
  const { event, page, metadata } = req.body;
  if (!event) return res.status(400).json({ error: 'event is required' });
  const userId = req.session?.userId || req.headers['x-user-id'] || null;
  const id = analytics.track(db, { event, page, userId, metadata });
  res.json({ ok: true, id });
});

module.exports = router;
