'use strict';
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const DB_PATH = path.join(__dirname, '..', 'hyperion.db');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');
const FILENAME_RE = /^hyperion_\d{8}_\d{6}\.db$/;

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') throw new Error('Filename required');
  if (!FILENAME_RE.test(filename)) throw new Error('Invalid backup filename');
}

function pad(n) { return String(n).padStart(2, '0'); }

function createBackup(db) {
  ensureBackupDir();
  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const filename = `hyperion_${stamp}.db`;
  const dest = path.join(BACKUP_DIR, filename);

  fs.copyFileSync(DB_PATH, dest);
  const stat = fs.statSync(dest);

  // Log to DB if available
  if (db) {
    try {
      db.prepare('INSERT INTO backup_log (id, filename, size_bytes, action) VALUES (?, ?, ?, ?)')
        .run(uuid(), filename, stat.size, 'create');
    } catch {}
  }

  return { filename, size: stat.size, timestamp: now.toISOString() };
}

function listBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR).filter(f => FILENAME_RE.test(f));
  const results = files.map(f => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return { filename: f, size: stat.size, createdAt: stat.birthtime.toISOString() };
  });
  results.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.filename.localeCompare(a.filename));
  return results;
}

function restoreBackup(filename, db) {
  validateFilename(filename);
  const src = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(src)) throw new Error('Backup file not found');
  fs.copyFileSync(src, DB_PATH);

  if (db) {
    try {
      db.prepare('INSERT INTO backup_log (id, filename, size_bytes, action) VALUES (?, ?, ?, ?)')
        .run(uuid(), filename, fs.statSync(src).size, 'restore');
    } catch {}
  }

  return { restored: filename, timestamp: new Date().toISOString() };
}

function deleteBackup(filename, db) {
  validateFilename(filename);
  const target = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(target)) throw new Error('Backup file not found');
  const size = fs.statSync(target).size;
  fs.unlinkSync(target);

  if (db) {
    try {
      db.prepare('INSERT INTO backup_log (id, filename, size_bytes, action) VALUES (?, ?, ?, ?)')
        .run(uuid(), filename, size, 'delete');
    } catch {}
  }

  return { deleted: filename };
}

function cleanOldBackups(keepDaily = 7, keepWeekly = 4) {
  const backups = listBackups(); // sorted newest-first
  if (backups.length === 0) return { kept: 0, deleted: 0 };

  const keep = new Set();
  const dailySeen = new Set();
  const weeklySeen = new Set();

  for (const b of backups) {
    const d = new Date(b.createdAt);
    const dayKey = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (!dailySeen.has(dayKey) && dailySeen.size < keepDaily) {
      dailySeen.add(dayKey);
      keep.add(b.filename);
    }
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekKey = `${weekStart.getFullYear()}-W${pad(weekStart.getMonth() + 1)}-${pad(weekStart.getDate())}`;
    if (!weeklySeen.has(weekKey) && weeklySeen.size < keepWeekly) {
      weeklySeen.add(weekKey);
      keep.add(b.filename);
    }
  }

  let deleted = 0;
  for (const b of backups) {
    if (!keep.has(b.filename)) {
      try { fs.unlinkSync(path.join(BACKUP_DIR, b.filename)); deleted++; } catch {}
    }
  }

  return { kept: keep.size, deleted };
}

function getBackupStats() {
  const backups = listBackups();
  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);
  return {
    count: backups.length,
    totalSize,
    oldest: backups.length ? backups[backups.length - 1].createdAt : null,
    newest: backups.length ? backups[0].createdAt : null,
  };
}

module.exports = {
  createBackup, listBackups, restoreBackup, deleteBackup,
  cleanOldBackups, getBackupStats, validateFilename,
  BACKUP_DIR, FILENAME_RE,
};
