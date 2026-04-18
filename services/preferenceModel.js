/**
 * Preference Model — Infers user preferences from usage patterns
 * Part of Tier 3: Learning Engine
 * Provides smart defaults, auto-approve suggestions, and time-based patterns.
 */

const { v4: uuidv4 } = require('uuid');
const usageTracker = require('./usageTracker');

// Minimum approvals before considering auto-approve
const AUTO_APPROVE_MIN_APPROVALS = 10;
const AUTO_APPROVE_MIN_RATIO = 1.0; // 100% approval rate required

// Tools that can NEVER be auto-approved regardless of history
const NEVER_AUTO_APPROVE = new Set(['run_command', 'scaffold_project']);

/**
 * Get list of tools that can be auto-approved based on user history.
 * A tool qualifies if: 10+ approvals, 0 denials, and not in the never-auto list.
 */
function getAutoApproveTools(db, userId) {
  if (!db || !userId) return [];

  const stats = usageTracker.getToolApprovalStats(db, userId);
  const autoApprove = [];

  for (const [tool, data] of Object.entries(stats)) {
    if (NEVER_AUTO_APPROVE.has(tool)) continue;
    if (data.approvals >= AUTO_APPROVE_MIN_APPROVALS && data.denials === 0) {
      autoApprove.push(tool);
    }
  }

  return autoApprove;
}

/**
 * Check if a specific tool call should be auto-approved.
 */
function shouldAutoApprove(db, userId, toolName, args) {
  if (NEVER_AUTO_APPROVE.has(toolName)) return false;

  // Check for destructive patterns in args
  const argsStr = JSON.stringify(args || {});
  if (usageTracker.NEVER_AUTO_APPROVE_PATTERNS.some(p => p.test(argsStr))) return false;

  const autoTools = getAutoApproveTools(db, userId);
  return autoTools.includes(toolName);
}

/**
 * Get smart defaults for a new task.
 * Returns suggested working directory and common patterns.
 */
function getSmartDefaults(db, userId) {
  if (!db || !userId) return {};

  const defaults = {};

  // Most-used working directory
  const dirs = usageTracker.getFrequentDirs(db, userId, 3);
  if (dirs.length > 0) {
    defaults.suggestedWorkDir = dirs[0].path;
    defaults.frequentDirs = dirs;
  }

  // Goal type suggestions based on time of day
  const goalStats = usageTracker.getGoalStats(db, userId);
  const hour = new Date().getHours();
  const dayOfWeek = new Date().getDay();
  const currentSlot = `${dayOfWeek}_${hour}`;

  const slotGoals = goalStats
    .filter(g => {
      const slots = g.timeSlots || {};
      return slots[currentSlot] > 0;
    })
    .sort((a, b) => (b.timeSlots?.[currentSlot] || 0) - (a.timeSlots?.[currentSlot] || 0));

  if (slotGoals.length > 0) {
    defaults.suggestedGoalType = slotGoals[0].type;
  }

  return defaults;
}

/**
 * Get or infer a specific preference.
 */
function getPreference(db, userId, key, defaultValue = null) {
  if (!db || !userId) return defaultValue;

  try {
    const row = db.prepare(
      "SELECT preference_value, confidence FROM user_preferences WHERE user_id = ? AND preference_key = ?"
    ).get(userId, key);

    if (row) return { value: row.preference_value, confidence: row.confidence };
    return defaultValue ? { value: defaultValue, confidence: 0 } : null;
  } catch {
    return defaultValue ? { value: defaultValue, confidence: 0 } : null;
  }
}

/**
 * Set an explicit user preference.
 */
function setPreference(db, userId, key, value, source = 'explicit') {
  if (!db || !userId) return;

  try {
    db.prepare(`INSERT INTO user_preferences (id, user_id, preference_key, preference_value, confidence, source, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, preference_key) DO UPDATE SET
        preference_value = excluded.preference_value,
        confidence = excluded.confidence,
        source = excluded.source,
        updated_at = datetime('now')
    `).run(uuidv4(), userId, key, String(value), source === 'explicit' ? 1.0 : 0.7, source);
  } catch (err) {
    console.error('[PreferenceModel] setPreference:', err.message);
  }
}

/**
 * Update experience confidence based on task feedback.
 * Positive feedback boosts, negative decreases.
 */
function applyFeedbackToExperiences(db, taskSessionId, rating) {
  if (!db || !taskSessionId) return;

  try {
    const adjustment = rating > 0 ? 0.1 : -0.15;
    db.prepare(
      "UPDATE agent_experiences SET confidence = MIN(1.0, MAX(0.0, confidence + ?)) WHERE task_session_id = ?"
    ).run(adjustment, taskSessionId);
  } catch {}
}

/**
 * Get all preferences for a user.
 */
function getAllPreferences(db, userId) {
  if (!db || !userId) return [];

  try {
    return db.prepare(
      "SELECT preference_key, preference_value, confidence, source, updated_at FROM user_preferences WHERE user_id = ? ORDER BY updated_at DESC"
    ).all(userId);
  } catch {
    return [];
  }
}

module.exports = {
  getAutoApproveTools,
  shouldAutoApprove,
  getSmartDefaults,
  getPreference,
  setPreference,
  applyFeedbackToExperiences,
  getAllPreferences,
};
