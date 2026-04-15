const express = require('express');
const router = express.Router();
const pom = require('../services/pomodoro');

// GET /api/pomodoro/active — Get active session
router.get('/active', (req, res) => {
  res.json(pom.getActiveSession(req.app.locals.db));
});

// GET /api/pomodoro/stats/day — Day stats
router.get('/stats/day', (req, res) => {
  res.json(pom.getDayStats(req.app.locals.db, req.query.date));
});

// GET /api/pomodoro/stats/week — Week stats
router.get('/stats/week', (req, res) => {
  res.json(pom.getWeekStats(req.app.locals.db));
});

// GET /api/pomodoro/streak — Current streak
router.get('/streak', (req, res) => {
  res.json(pom.getStreak(req.app.locals.db));
});

// GET /api/pomodoro/defaults — Default settings
router.get('/defaults', (req, res) => {
  res.json(pom.getDefaults());
});

// GET /api/pomodoro — List sessions
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(pom.getSessions(req.app.locals.db, limit));
});

// POST /api/pomodoro/start — Start session
router.post('/start', (req, res) => {
  try {
    const result = pom.startSession(req.app.locals.db, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/pomodoro/:id/complete — Complete session
router.post('/:id/complete', (req, res) => {
  try {
    const result = pom.completeSession(req.app.locals.db, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/pomodoro/:id/cancel — Cancel session
router.post('/:id/cancel', (req, res) => {
  try {
    const result = pom.cancelSession(req.app.locals.db, req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
