/**
 * Failure Analyzer — Reviews failed tasks and generates improvement strategies
 * Part of Tier 4: Autonomous Self-Improvement
 * Runs as a nightly cron (3 AM) or on-demand.
 */

const llm = require('./llmService');
const { v4: uuidv4 } = require('uuid');

const ANALYSIS_PROMPT = `You are an AI operations analyst. Analyze these failed task executions and identify patterns.

Failed experiences (last 7 days):
{FAILURES}

For each cluster of similar failures, suggest a concrete strategy that would prevent or recover from the failure.

Respond with ONLY a JSON array:
[
  {
    "taskPattern": "short pattern description (e.g. 'file search in large directories')",
    "rootCause": "brief explanation of why these failed",
    "strategy": "concrete step-by-step approach to avoid or recover from this failure",
    "affectedCount": number_of_affected_experiences
  }
]

Max 5 strategies. Focus on the most impactful patterns.`;

/**
 * Analyze recent failures and generate strategies.
 * @param {object} db - SQLite database instance
 * @returns {Array} Generated strategies
 */
async function analyzeRecentFailures(db) {
  if (!db) return [];

  // Get failed experiences from last 7 days
  let failures;
  try {
    failures = db.prepare(
      "SELECT goal_summary, tool_sequence, outcome, error_type, reflection_notes, recovery_action FROM agent_experiences WHERE outcome = 'failure' AND created_at > datetime('now', '-7 days') ORDER BY created_at DESC LIMIT 50"
    ).all();
  } catch {
    return [];
  }

  if (failures.length < 2) return []; // Not enough data to analyze

  const failureSummary = failures.map((f, i) =>
    `${i + 1}. Goal: "${f.goal_summary}" | Error: ${f.error_type || 'unknown'} | Tools: ${f.tool_sequence || '[]'} | Notes: ${f.reflection_notes || 'none'}`
  ).join('\n');

  try {
    const response = await llm.callWithFailover(
      [{ role: 'user', content: ANALYSIS_PROMPT.replace('{FAILURES}', failureSummary) }],
      { max_tokens: 1024, temperature: 0.2 }
    );

    const strategies = _parseJSON(response.content, []);
    if (!Array.isArray(strategies)) return [];

    // Store strategies in the library
    const stored = [];
    for (const s of strategies.slice(0, 5)) {
      if (!s.taskPattern || !s.strategy) continue;

      try {
        // Check if pattern already exists
        const existing = db.prepare(
          "SELECT id, uses, success_rate FROM strategy_library WHERE task_pattern = ?"
        ).get(s.taskPattern);

        if (existing) {
          // Update existing strategy
          db.prepare(
            "UPDATE strategy_library SET strategy = ?, created_at = datetime('now') WHERE id = ?"
          ).run(s.strategy, existing.id);
          stored.push({ id: existing.id, pattern: s.taskPattern, updated: true });
        } else {
          // Insert new strategy
          const id = uuidv4();
          db.prepare(
            "INSERT INTO strategy_library (id, task_pattern, strategy, success_rate, uses, created_at) VALUES (?, ?, ?, 0.5, 0, datetime('now'))"
          ).run(id, s.taskPattern, s.strategy);
          stored.push({ id, pattern: s.taskPattern, new: true });
        }
      } catch {}
    }

    return stored;
  } catch (err) {
    console.error('[FailureAnalyzer] Analysis failed:', err.message);
    return [];
  }
}

/**
 * Get a summary of failure patterns (no LLM call).
 */
function getFailurePatterns(db) {
  if (!db) return [];

  try {
    return db.prepare(
      "SELECT error_type, COUNT(*) as count, GROUP_CONCAT(DISTINCT goal_summary) as examples FROM agent_experiences WHERE outcome = 'failure' AND created_at > datetime('now', '-7 days') GROUP BY error_type ORDER BY count DESC LIMIT 10"
    ).all().map(r => ({
      errorType: r.error_type || 'unknown',
      count: r.count,
      examples: (r.examples || '').split(',').slice(0, 3),
    }));
  } catch {
    return [];
  }
}

function _parseJSON(text, fallback) {
  try {
    const cleaned = text.trim()
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return fallback;
  }
}

module.exports = { analyzeRecentFailures, getFailurePatterns };
