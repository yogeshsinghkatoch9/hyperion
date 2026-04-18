/**
 * Strategy Library — Task-pattern → strategy mapping
 * Part of Tier 4: Autonomous Self-Improvement
 * Consulted during plan generation to inject winning strategies.
 */

/**
 * Search for strategies that match a goal.
 * Uses keyword overlap scoring (no LLM needed for search).
 * @param {object} db - SQLite database
 * @param {string} goal - The task goal
 * @param {number} topK - Max results
 * @returns {Array<{ taskPattern, strategy, successRate, uses }>}
 */
function searchStrategies(db, goal, topK = 3) {
  if (!db || !goal) return [];

  try {
    const rows = db.prepare(
      "SELECT id, task_pattern, strategy, success_rate, uses FROM strategy_library ORDER BY success_rate DESC, uses DESC"
    ).all();

    if (!rows.length) return [];

    const goalTokens = _tokenize(goal);

    return rows
      .map(r => {
        const patternTokens = _tokenize(r.task_pattern);
        const overlap = _tokenOverlap(goalTokens, patternTokens);
        return { ...r, relevance: overlap };
      })
      .filter(r => r.relevance > 0.1)
      .sort((a, b) => (b.relevance * b.success_rate) - (a.relevance * a.success_rate))
      .slice(0, topK)
      .map(({ id, task_pattern, strategy, success_rate, uses }) => ({
        taskPattern: task_pattern,
        strategy,
        successRate: success_rate,
        uses,
      }));
  } catch {
    return [];
  }
}

/**
 * Format strategies as prompt context for plan generation.
 */
function formatAsContext(strategies) {
  if (!strategies || strategies.length === 0) return '';

  const lines = strategies.map((s, i) =>
    `${i + 1}. Pattern: "${s.taskPattern}" (${Math.round(s.successRate * 100)}% success, ${s.uses} uses)\n   Strategy: ${s.strategy}`
  );

  return `LEARNED STRATEGIES (from past tasks):\n${lines.join('\n')}`;
}

/**
 * Record that a strategy was used and whether it succeeded.
 */
function recordStrategyUse(db, taskPattern, success) {
  if (!db || !taskPattern) return;

  try {
    const row = db.prepare(
      "SELECT id, uses, success_rate FROM strategy_library WHERE task_pattern = ?"
    ).get(taskPattern);

    if (!row) return;

    const newUses = row.uses + 1;
    // Exponential moving average: 0.7 * old + 0.3 * new
    const newRate = (row.success_rate * 0.7) + ((success ? 1 : 0) * 0.3);

    db.prepare(
      "UPDATE strategy_library SET uses = ?, success_rate = ?, last_used = datetime('now') WHERE id = ?"
    ).run(newUses, Math.round(newRate * 100) / 100, row.id);
  } catch {}
}

/**
 * Demote strategies that have consistently low success rates.
 * Called during nightly analysis.
 */
function demoteFailingStrategies(db) {
  if (!db) return 0;

  try {
    // Delete strategies with <20% success rate and 5+ uses
    const result = db.prepare(
      "DELETE FROM strategy_library WHERE success_rate < 0.2 AND uses >= 5"
    ).run();
    return result.changes;
  } catch {
    return 0;
  }
}

/**
 * Get all strategies for the dashboard.
 */
function getAllStrategies(db) {
  if (!db) return [];

  try {
    return db.prepare(
      "SELECT task_pattern, strategy, success_rate, uses, last_used, created_at FROM strategy_library ORDER BY success_rate DESC"
    ).all();
  } catch {
    return [];
  }
}

/**
 * Get aggregate metrics for the AI Quality dashboard.
 */
function getAgentMetrics(db) {
  if (!db) return {};

  try {
    // Experience stats
    const totalTasks = db.prepare("SELECT COUNT(DISTINCT task_session_id) as c FROM agent_experiences WHERE task_session_id IS NOT NULL").get()?.c || 0;
    const totalSteps = db.prepare("SELECT COUNT(*) as c FROM agent_experiences").get()?.c || 0;
    const successSteps = db.prepare("SELECT COUNT(*) as c FROM agent_experiences WHERE outcome = 'success'").get()?.c || 0;

    // Feedback stats
    const totalFeedback = db.prepare("SELECT COUNT(*) as c FROM task_feedback").get()?.c || 0;
    const positiveFeedback = db.prepare("SELECT COUNT(*) as c FROM task_feedback WHERE rating > 0").get()?.c || 0;

    // Strategy stats
    const totalStrategies = db.prepare("SELECT COUNT(*) as c FROM strategy_library").get()?.c || 0;
    const avgStrategySuccess = db.prepare("SELECT AVG(success_rate) as avg FROM strategy_library").get()?.avg || 0;

    // Task session stats
    const completedTasks = db.prepare("SELECT COUNT(*) as c FROM task_sessions WHERE status = 'completed'").get()?.c || 0;
    const failedTasks = db.prepare("SELECT COUNT(*) as c FROM task_sessions WHERE status = 'failed'").get()?.c || 0;

    // Avg steps per task
    const avgStepsRow = db.prepare(
      "SELECT AVG(json_array_length(plan)) as avg FROM task_sessions WHERE plan != '[]'"
    ).get();

    return {
      totalTasks,
      completedTasks,
      failedTasks,
      taskSuccessRate: totalTasks > 0 ? Math.round((completedTasks / (completedTasks + failedTasks || 1)) * 100) : 0,
      totalSteps,
      stepSuccessRate: totalSteps > 0 ? Math.round((successSteps / totalSteps) * 100) : 0,
      avgStepsPerTask: Math.round(avgStepsRow?.avg || 0),
      satisfactionRate: totalFeedback > 0 ? Math.round((positiveFeedback / totalFeedback) * 100) : 0,
      totalStrategies,
      avgStrategySuccess: Math.round(avgStrategySuccess * 100),
    };
  } catch (err) {
    console.error('[StrategyLibrary] getAgentMetrics:', err.message);
    return {};
  }
}

// ── Helpers ──

function _tokenize(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function _tokenOverlap(a, b) {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(t => setB.has(t)).length;
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

module.exports = {
  searchStrategies,
  formatAsContext,
  recordStrategyUse,
  demoteFailingStrategies,
  getAllStrategies,
  getAgentMetrics,
};
