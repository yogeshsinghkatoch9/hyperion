/**
 * Scheduled Backup Service — periodic database backups via cron expressions
 */
'use strict';
const backupService = require('./backupService');
const { parseCron, matchesCron } = require('./cronScheduler');
const { notify } = require('./notify');

let _db = null;
let _interval = null;

function getSetting(db, key, fallback) {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE user_id = 'system' AND key = ?").get(key);
    if (row) {
      try { return JSON.parse(row.value); } catch { return row.value; }
    }
  } catch {}
  return fallback;
}

function setSetting(db, key, value) {
  const val = typeof value === 'string' ? value : JSON.stringify(value);
  db.prepare(
    "INSERT INTO settings (user_id, key, value, updated_at) VALUES ('system', ?, ?, datetime('now')) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')"
  ).run(key, val);
}

function checkAndRun() {
  if (!_db) return;

  const schedule = getSetting(_db, 'backup_schedule', null);
  if (!schedule) return;

  const cron = parseCron(schedule);
  if (!cron) return;

  const now = new Date();
  if (!matchesCron(cron, now)) return;

  // Dedup: skip if ran within last 2 minutes
  const lastRun = getSetting(_db, 'backup_last_run', null);
  if (lastRun) {
    const diff = now.getTime() - new Date(lastRun).getTime();
    if (diff < 120000) return;
  }

  try {
    const result = backupService.createBackup(_db);
    setSetting(_db, 'backup_last_run', now.toISOString());

    // Clean old backups
    const retentionDays = getSetting(_db, 'backup_retention_days', 7);
    backupService.cleanOldBackups(retentionDays, Math.ceil(retentionDays / 7));

    notify(_db, {
      title: 'Scheduled Backup Complete',
      message: `Created ${result.filename} (${(result.size / 1024).toFixed(1)} KB)`,
      source: 'system',
      level: 'success',
    });

    return result;
  } catch (err) {
    notify(_db, {
      title: 'Scheduled Backup Failed',
      message: err.message,
      source: 'system',
      level: 'error',
    });
    return null;
  }
}

function start(db) {
  _db = db;
  if (_interval) clearInterval(_interval);
  _interval = setInterval(checkAndRun, 60000);
}

function stop() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

module.exports = { start, stop, checkAndRun, getSetting, setSetting };
