/**
 * Usage Tracker — Records tool approvals, goal types, time patterns, frequent paths
 * Part of Tier 3: Learning Engine
 */

const { v4: uuidv4 } = require('uuid');

// Destructive patterns that should NEVER be auto-approved
const NEVER_AUTO_APPROVE_PATTERNS = [
  /rm\s+(-rf?|--force)/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown|reboot|poweroff/i,
  /docker\s+(rm|stop|kill)/i,
  /git\s+(push\s+--force|reset\s+--hard)/i,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM/i,
];

/**
 * Record a tool approval/denial event.
 */
function recordToolApproval(db, userId, toolName, args, approved) {
  if (!db || !userId) return;

  const key = toolName;
  const hour = new Date().getHours();

  try {
    const existing = db.prepare(
      "SELECT id, value FROM usage_patterns WHERE user_id = ? AND pattern_type = 'tool_approval' AND key = ?"
    ).get(userId, key);

    if (existing) {
      const val = _safeParse(existing.value, { approvals: 0, denials: 0, lastArgs: [] });
      if (approved) val.approvals++; else val.denials++;
      val.lastArgs = (val.lastArgs || []).slice(-5);
      val.lastArgs.push({ args: _summarizeArgs(args), time: hour, approved });
      db.prepare(
        "UPDATE usage_patterns SET value = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(JSON.stringify(val), existing.id);
    } else {
      db.prepare(
        "INSERT INTO usage_patterns (id, user_id, pattern_type, key, value, updated_at) VALUES (?, ?, 'tool_approval', ?, ?, datetime('now'))"
      ).run(uuidv4(), userId, key, JSON.stringify({
        approvals: approved ? 1 : 0,
        denials: approved ? 0 : 1,
        lastArgs: [{ args: _summarizeArgs(args), time: hour, approved }],
      }));
    }
  } catch (err) {
    console.error('[UsageTracker] recordToolApproval:', err.message);
  }
}

/**
 * Record a goal completion event (for pattern analysis).
 */
function recordGoalCompletion(db, userId, goal, success, stepCount) {
  if (!db || !userId) return;

  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const goalType = _classifyGoal(goal);

  try {
    const key = goalType;
    const existing = db.prepare(
      "SELECT id, value FROM usage_patterns WHERE user_id = ? AND pattern_type = 'goal_completion' AND key = ?"
    ).get(userId, key);

    if (existing) {
      const val = _safeParse(existing.value, { total: 0, successes: 0, timeSlots: {}, avgSteps: 0 });
      val.total++;
      if (success) val.successes++;
      const slot = `${dayOfWeek}_${hour}`;
      val.timeSlots[slot] = (val.timeSlots[slot] || 0) + 1;
      val.avgSteps = Math.round(((val.avgSteps * (val.total - 1)) + stepCount) / val.total);
      db.prepare(
        "UPDATE usage_patterns SET value = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(JSON.stringify(val), existing.id);
    } else {
      const slot = `${dayOfWeek}_${hour}`;
      db.prepare(
        "INSERT INTO usage_patterns (id, user_id, pattern_type, key, value, updated_at) VALUES (?, ?, 'goal_completion', ?, ?, datetime('now'))"
      ).run(uuidv4(), userId, key, JSON.stringify({
        total: 1,
        successes: success ? 1 : 0,
        timeSlots: { [slot]: 1 },
        avgSteps: stepCount,
      }));
    }
  } catch (err) {
    console.error('[UsageTracker] recordGoalCompletion:', err.message);
  }
}

/**
 * Record a frequently used working directory.
 */
function recordWorkingDir(db, userId, dirPath) {
  if (!db || !userId || !dirPath) return;

  try {
    const existing = db.prepare(
      "SELECT id, value FROM usage_patterns WHERE user_id = ? AND pattern_type = 'working_dir' AND key = ?"
    ).get(userId, dirPath);

    if (existing) {
      const val = _safeParse(existing.value, { count: 0 });
      val.count++;
      db.prepare(
        "UPDATE usage_patterns SET value = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(JSON.stringify(val), existing.id);
    } else {
      db.prepare(
        "INSERT INTO usage_patterns (id, user_id, pattern_type, key, value, updated_at) VALUES (?, ?, 'working_dir', ?, ?, datetime('now'))"
      ).run(uuidv4(), userId, dirPath, JSON.stringify({ count: 1 }));
    }
  } catch {}
}

/**
 * Get tool approval stats for a user.
 * Returns map of toolName → { approvals, denials }
 */
function getToolApprovalStats(db, userId) {
  if (!db || !userId) return {};

  try {
    const rows = db.prepare(
      "SELECT key, value FROM usage_patterns WHERE user_id = ? AND pattern_type = 'tool_approval'"
    ).all(userId);

    const stats = {};
    for (const row of rows) {
      stats[row.key] = _safeParse(row.value, { approvals: 0, denials: 0 });
    }
    return stats;
  } catch {
    return {};
  }
}

/**
 * Get the most frequently used working directories.
 */
function getFrequentDirs(db, userId, limit = 5) {
  if (!db || !userId) return [];

  try {
    const rows = db.prepare(
      "SELECT key, value FROM usage_patterns WHERE user_id = ? AND pattern_type = 'working_dir' ORDER BY updated_at DESC LIMIT ?"
    ).all(userId, limit);

    return rows.map(r => ({
      path: r.key,
      count: _safeParse(r.value, { count: 0 }).count,
    })).sort((a, b) => b.count - a.count);
  } catch {
    return [];
  }
}

/**
 * Get goal type frequency stats.
 */
function getGoalStats(db, userId) {
  if (!db || !userId) return [];

  try {
    const rows = db.prepare(
      "SELECT key, value FROM usage_patterns WHERE user_id = ? AND pattern_type = 'goal_completion' ORDER BY updated_at DESC"
    ).all(userId);

    return rows.map(r => ({
      type: r.key,
      ..._safeParse(r.value, { total: 0, successes: 0, avgSteps: 0 }),
    }));
  } catch {
    return [];
  }
}

/**
 * Record task feedback (thumbs up/down).
 */
function recordFeedback(db, userId, taskSessionId, rating, comment) {
  if (!db || !userId || !taskSessionId) return null;

  try {
    const id = uuidv4();
    db.prepare(
      "INSERT INTO task_feedback (id, task_session_id, user_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    ).run(id, taskSessionId, userId, rating, comment || null);
    return id;
  } catch (err) {
    console.error('[UsageTracker] recordFeedback:', err.message);
    return null;
  }
}

// ── Helpers ──

function _classifyGoal(goal) {
  const lower = goal.toLowerCase();
  if (/\b(list|find|search|show|get|read|check)\b/.test(lower)) return 'exploration';
  if (/\b(create|write|scaffold|generate|build|make)\b/.test(lower)) return 'creation';
  if (/\b(deploy|push|docker|ssh|server)\b/.test(lower)) return 'deployment';
  if (/\b(fix|debug|repair|troubleshoot|resolve)\b/.test(lower)) return 'debugging';
  if (/\b(update|modify|change|edit|refactor)\b/.test(lower)) return 'modification';
  if (/\b(delete|remove|clean|purge)\b/.test(lower)) return 'cleanup';
  if (/\b(git|commit|branch|merge)\b/.test(lower)) return 'version_control';
  if (/\b(install|setup|configure|init)\b/.test(lower)) return 'setup';
  return 'general';
}

function _summarizeArgs(args) {
  if (!args) return '';
  const s = JSON.stringify(args);
  return s.length > 100 ? s.slice(0, 100) + '...' : s;
}

function _safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

module.exports = {
  recordToolApproval,
  recordGoalCompletion,
  recordWorkingDir,
  recordFeedback,
  getToolApprovalStats,
  getFrequentDirs,
  getGoalStats,
  NEVER_AUTO_APPROVE_PATTERNS,
};
