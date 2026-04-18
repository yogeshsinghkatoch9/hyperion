/**
 * Task Engine Route — SSE streaming for autonomous task execution
 * Mirrors the pattern from routes/chat.js
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const taskEngine = require('../services/taskEngine');
const experienceMemory = require('../services/experienceMemory');
const usageTracker = require('../services/usageTracker');
const preferenceModel = require('../services/preferenceModel');
const strategyLibrary = require('../services/strategyLibrary');
const failureAnalyzer = require('../services/failureAnalyzer');
const benchmarkHarness = require('../services/benchmarkHarness');

// ── Start a Task (SSE stream) ──
router.post('/run', async (req, res) => {
  const db = req.app.locals.db;
  const { goal, sessionId: existingSessionId } = req.body;
  if (!goal) return res.status(400).json({ error: 'Goal required' });

  const sessionId = existingSessionId || uuidv4();

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    const gen = taskEngine.runTaskEngine(goal, db, req.session.userId, sessionId);

    for await (const event of gen) {
      if (res.destroyed) break;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.write('event: close\ndata: {}\n\n');
  res.end();
});

// ── Preview Plan Only (no execution) ──
router.post('/preview', async (req, res) => {
  const { goal } = req.body;
  if (!goal) return res.status(400).json({ error: 'Goal required' });

  try {
    const plan = await taskEngine.generatePlan(goal);
    res.json({ plan });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── List Task Sessions ──
router.get('/sessions', (req, res) => {
  const db = req.app.locals.db;
  try {
    const sessions = db.prepare(
      'SELECT id, goal, status, current_step, created_at, updated_at FROM task_sessions WHERE user_id = ? ORDER BY updated_at DESC'
    ).all(req.session.userId);
    // Parse plan to get step count
    const enriched = sessions.map(s => {
      let stepCount = 0;
      try {
        const row = db.prepare('SELECT plan FROM task_sessions WHERE id = ?').get(s.id);
        if (row?.plan) stepCount = JSON.parse(row.plan).length;
      } catch {}
      return { ...s, stepCount };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get Task Session Details ──
router.get('/sessions/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const row = db.prepare('SELECT * FROM task_sessions WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.session.userId);
    if (!row) return res.status(404).json({ error: 'Session not found' });
    row.plan = JSON.parse(row.plan || '[]');
    row.results = JSON.parse(row.results || '[]');
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete Task Session ──
router.delete('/sessions/:id', (req, res) => {
  const db = req.app.locals.db;
  try {
    const result = db.prepare('DELETE FROM task_sessions WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.session.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Session not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Approve/Deny Pending Tool Call ──
router.post('/approve', (req, res) => {
  const db = req.app.locals.db;
  const { sessionId, approved } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const pending = taskEngine.getTaskPendingApproval(sessionId);
  if (!pending) return res.status(404).json({ error: 'No pending approval' });

  // Tier 3: Record tool approval for learning
  try {
    usageTracker.recordToolApproval(db, req.session.userId, pending.toolName, pending.args, !!approved);
  } catch {}

  pending.resolve(!!approved);
  res.json({ ok: true, approved: !!approved });
});

// ── Resume a Paused/Failed Task (SSE stream) ──
router.post('/sessions/:id/resume', async (req, res) => {
  const db = req.app.locals.db;
  const sessionId = req.params.id;

  try {
    const row = db.prepare('SELECT * FROM task_sessions WHERE id = ? AND user_id = ?')
      .get(sessionId, req.session.userId);
    if (!row) return res.status(404).json({ error: 'Session not found' });
    if (row.status !== 'paused' && row.status !== 'failed') {
      return res.status(400).json({ error: `Cannot resume session with status: ${row.status}` });
    }

    // Re-run from where it left off
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const gen = taskEngine.runTaskEngine(row.goal, db, req.session.userId, sessionId);

    for await (const event of gen) {
      if (res.destroyed) break;
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.write('event: close\ndata: {}\n\n');
  res.end();
});

// ── Experience Memory Stats ──
router.get('/experiences/stats', (req, res) => {
  const db = req.app.locals.db;
  try {
    const stats = experienceMemory.getStats(db);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Task Feedback (Tier 3) ──
router.post('/sessions/:id/feedback', (req, res) => {
  const db = req.app.locals.db;
  const { rating, comment } = req.body;
  if (rating === undefined) return res.status(400).json({ error: 'rating required (-1 or 1)' });

  try {
    const id = usageTracker.recordFeedback(db, req.session.userId, req.params.id, rating, comment);
    if (!id) return res.status(500).json({ error: 'Failed to record feedback' });

    // Update experience confidence based on feedback
    preferenceModel.applyFeedbackToExperiences(db, req.params.id, rating);

    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Smart Defaults (Tier 3) ──
router.get('/smart-defaults', (req, res) => {
  const db = req.app.locals.db;
  try {
    const defaults = preferenceModel.getSmartDefaults(db, req.session.userId);
    const autoApproveTools = preferenceModel.getAutoApproveTools(db, req.session.userId);
    res.json({ ...defaults, autoApproveTools });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── User Preferences (Tier 3) ──
router.get('/preferences', (req, res) => {
  const db = req.app.locals.db;
  try {
    const prefs = preferenceModel.getAllPreferences(db, req.session.userId);
    res.json(prefs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/preferences', (req, res) => {
  const db = req.app.locals.db;
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ error: 'key and value required' });

  try {
    preferenceModel.setPreference(db, req.session.userId, key, value, 'explicit');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Agent Quality Metrics (Tier 4) ──
router.get('/agent/metrics', (req, res) => {
  const db = req.app.locals.db;
  try {
    const metrics = strategyLibrary.getAgentMetrics(db);
    const failurePatterns = failureAnalyzer.getFailurePatterns(db);
    const strategies = strategyLibrary.getAllStrategies(db);
    res.json({ metrics, failurePatterns, strategies });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Trigger Failure Analysis (Tier 4) — on-demand ──
router.post('/agent/analyze', async (req, res) => {
  const db = req.app.locals.db;
  try {
    const results = await failureAnalyzer.analyzeRecentFailures(db);
    // Also demote failing strategies
    const demoted = strategyLibrary.demoteFailingStrategies(db);
    res.json({ strategies: results, demoted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Benchmarks (Tier 5) ──
router.get('/benchmarks', (req, res) => {
  try {
    const benchmarks = benchmarkHarness.listBenchmarks();
    res.json(benchmarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/benchmarks/init', (req, res) => {
  try {
    const filePath = benchmarkHarness.createSampleBenchmark();
    res.json({ ok: true, filePath });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/benchmarks/run', async (req, res) => {
  const db = req.app.locals.db;
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename required' });

  // SSE stream for benchmark execution
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    const benchmark = benchmarkHarness.loadBenchmark(filename);
    res.write(`event: benchmark_start\ndata: ${JSON.stringify({ name: benchmark.name, taskCount: benchmark.taskCount })}\n\n`);

    const results = [];

    for (let i = 0; i < benchmark.tasks.length; i++) {
      const task = benchmark.tasks[i];
      res.write(`event: task_start\ndata: ${JSON.stringify({ index: i, id: task.id, goal: task.goal })}\n\n`);

      const startTime = Date.now();
      let taskResult = { success: false, summary: '' };

      try {
        // Run the task through the task engine
        const gen = taskEngine.runTaskEngine(task.goal, db, req.session.userId);
        for await (const event of gen) {
          if (res.destroyed) break;
          if (event.type === 'task_complete') {
            taskResult = event.data;
          }
        }
      } catch (err) {
        taskResult = { success: false, summary: err.message };
      }

      const duration = Date.now() - startTime;
      const score = benchmarkHarness.scoreTask(task, taskResult);

      results.push({ taskId: task.id, ...score, duration });
      res.write(`event: task_complete\ndata: ${JSON.stringify({ index: i, id: task.id, ...score, duration })}\n\n`);
    }

    const report = benchmarkHarness.generateReport(benchmark.name, results);
    const reportPath = benchmarkHarness.saveReport(report);
    res.write(`event: benchmark_complete\ndata: ${JSON.stringify({ ...report, reportPath })}\n\n`);
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.write('event: close\ndata: {}\n\n');
  res.end();
});

module.exports = router;
