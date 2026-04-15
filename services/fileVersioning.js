/**
 * File Versioning — auto-save file history, diff any two versions
 */
'use strict';
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const MAX_VERSIONS_PER_FILE = 50;

function hashContent(content) {
  return crypto.createHash('sha256').update(content || '').digest('hex').slice(0, 16);
}

function saveVersion(db, filePath, content, reason = 'edit') {
  const hash = hashContent(content);

  // Skip if content hasn't changed
  const latest = db.prepare(
    'SELECT hash FROM file_versions WHERE file_path = ? ORDER BY created_at DESC LIMIT 1'
  ).get(filePath);
  if (latest && latest.hash === hash) return null;

  const id = uuidv4();
  const size = Buffer.byteLength(content || '', 'utf8');
  db.prepare(
    'INSERT INTO file_versions (id, file_path, content, size, hash, reason) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, filePath, content, size, hash, reason);

  // Prune old versions
  pruneVersions(db, filePath);

  return { id, filePath, size, hash, reason };
}

function listVersions(db, filePath, limit = 20) {
  return db.prepare(
    'SELECT id, file_path, size, hash, reason, created_at FROM file_versions WHERE file_path = ? ORDER BY created_at DESC LIMIT ?'
  ).all(filePath, limit);
}

function getVersion(db, id) {
  const version = db.prepare('SELECT * FROM file_versions WHERE id = ?').get(id);
  if (!version) throw new Error('Version not found');
  return version;
}

function diffVersions(db, idA, idB) {
  const a = getVersion(db, idA);
  const b = getVersion(db, idB);

  const linesA = (a.content || '').split('\n');
  const linesB = (b.content || '').split('\n');

  // Simple line-based diff
  const changes = [];
  const maxLen = Math.max(linesA.length, linesB.length);

  for (let i = 0; i < maxLen; i++) {
    const lineA = linesA[i];
    const lineB = linesB[i];
    if (lineA === lineB) {
      changes.push({ type: 'equal', line: i + 1, content: lineA || '' });
    } else if (lineA === undefined) {
      changes.push({ type: 'added', line: i + 1, content: lineB });
    } else if (lineB === undefined) {
      changes.push({ type: 'removed', line: i + 1, content: lineA });
    } else {
      changes.push({ type: 'removed', line: i + 1, content: lineA });
      changes.push({ type: 'added', line: i + 1, content: lineB });
    }
  }

  const added = changes.filter(c => c.type === 'added').length;
  const removed = changes.filter(c => c.type === 'removed').length;

  return {
    versionA: { id: a.id, hash: a.hash, created_at: a.created_at },
    versionB: { id: b.id, hash: b.hash, created_at: b.created_at },
    changes: changes.filter(c => c.type !== 'equal'),
    stats: { added, removed, unchanged: changes.filter(c => c.type === 'equal').length },
  };
}

function restoreVersion(db, id) {
  const version = getVersion(db, id);
  return { filePath: version.file_path, content: version.content };
}

function deleteVersion(db, id) {
  const info = db.prepare('DELETE FROM file_versions WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Version not found');
  return { deleted: true };
}

function pruneVersions(db, filePath) {
  const versions = db.prepare(
    'SELECT id FROM file_versions WHERE file_path = ? ORDER BY created_at DESC'
  ).all(filePath);

  if (versions.length > MAX_VERSIONS_PER_FILE) {
    const toDelete = versions.slice(MAX_VERSIONS_PER_FILE);
    const ids = toDelete.map(v => `'${v.id}'`).join(',');
    db.exec(`DELETE FROM file_versions WHERE id IN (${ids})`);
  }
}

function getVersionedFiles(db, limit = 50) {
  return db.prepare(
    `SELECT file_path, COUNT(*) as version_count, MAX(created_at) as last_modified
     FROM file_versions GROUP BY file_path ORDER BY last_modified DESC LIMIT ?`
  ).all(limit);
}

module.exports = {
  saveVersion, listVersions, getVersion, diffVersions,
  restoreVersion, deleteVersion, pruneVersions,
  getVersionedFiles, hashContent, MAX_VERSIONS_PER_FILE,
};
