/**
 * Notification Helper — create notifications from anywhere in the backend
 */
const { v4: uuidv4 } = require('uuid');

// Map source to notification category for preference checks
const SOURCE_TO_CATEGORY = {
  agent: 'agent_complete',
  workflow: 'workflow_complete',
  backup: 'backup_complete',
  system: 'system_alert',
  security: 'security_alert',
};

/**
 * Create a notification
 * @param {object} db - better-sqlite3 database instance
 * @param {object} opts - { title, message, source, level, userId }
 *   source: 'system' | 'agent' | 'workflow' | 'assistant' | 'backup' | 'security'
 *   level:  'info' | 'success' | 'warning' | 'error'
 *   userId: optional — if provided, check notification preferences
 */
function notify(db, { title, message = '', source = 'system', level = 'info', userId = null }) {
  // Check notification preferences if userId provided
  if (userId) {
    const category = SOURCE_TO_CATEGORY[source];
    if (category) {
      try {
        const pref = db.prepare('SELECT enabled FROM notification_preferences WHERE user_id = ? AND category = ?').get(userId, category);
        if (pref && !pref.enabled) return null; // User disabled this category
      } catch {}
    }
  }

  const id = uuidv4();
  try {
    db.prepare(
      'INSERT INTO notifications (id, title, message, source, level) VALUES (?, ?, ?, ?, ?)'
    ).run(id, title, message, source, level);
  } catch (err) {
    console.error('[notify] Failed to insert notification:', err.message);
  }
  return id;
}

module.exports = { notify, SOURCE_TO_CATEGORY };
