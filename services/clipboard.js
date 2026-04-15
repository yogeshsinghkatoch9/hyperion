const { v4: uuidv4 } = require('uuid');

// ── Tag Parsing ──
function parseTags(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(t => String(t).trim()).filter(Boolean);
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.startsWith('[')) {
      try { return JSON.parse(trimmed).map(t => String(t).trim()).filter(Boolean); } catch { /* fall through */ }
    }
    return trimmed.split(',').map(t => t.trim()).filter(Boolean);
  }
  return [];
}

// ── CRUD ──
function saveClip(db, { content, label, tags }) {
  if (!content) throw new Error('Content is required');
  const id = uuidv4();
  const now = new Date().toISOString();
  const tagArr = parseTags(tags);
  db.prepare('INSERT INTO clipboard_items (id, content, label, tags, pinned, created_at) VALUES (?, ?, ?, ?, 0, ?)')
    .run(id, content, label || '', JSON.stringify(tagArr), now);
  return { id, label: label || '', created_at: now };
}

function getClips(db, limit) {
  const lim = limit || 100;
  return db.prepare('SELECT * FROM clipboard_items ORDER BY pinned DESC, created_at DESC LIMIT ?').all(lim).map(r => ({
    ...r, tags: JSON.parse(r.tags || '[]'), pinned: !!r.pinned,
  }));
}

function getClip(db, id) {
  const row = db.prepare('SELECT * FROM clipboard_items WHERE id = ?').get(id);
  if (!row) throw new Error('Clip not found');
  return { ...row, tags: JSON.parse(row.tags || '[]'), pinned: !!row.pinned };
}

function updateClip(db, id, updates) {
  const clip = getClip(db, id);
  const label = updates.label !== undefined ? updates.label : clip.label;
  const tags = updates.tags !== undefined ? JSON.stringify(parseTags(updates.tags)) : JSON.stringify(clip.tags);
  db.prepare('UPDATE clipboard_items SET label=?, tags=? WHERE id=?').run(label, tags, id);
  return { id, label };
}

function deleteClip(db, id) {
  const r = db.prepare('DELETE FROM clipboard_items WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Clip not found');
}

function pinClip(db, id) {
  getClip(db, id); // ensure exists
  db.prepare('UPDATE clipboard_items SET pinned = 1 WHERE id = ?').run(id);
  return { id, pinned: true };
}

function unpinClip(db, id) {
  getClip(db, id);
  db.prepare('UPDATE clipboard_items SET pinned = 0 WHERE id = ?').run(id);
  return { id, pinned: false };
}

function searchClips(db, query) {
  if (!query) return getClips(db);
  const q = `%${query}%`;
  return db.prepare('SELECT * FROM clipboard_items WHERE content LIKE ? OR label LIKE ? OR tags LIKE ? ORDER BY pinned DESC, created_at DESC')
    .all(q, q, q).map(r => ({
      ...r, tags: JSON.parse(r.tags || '[]'), pinned: !!r.pinned,
    }));
}

function getClipStats(db) {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM clipboard_items').get().cnt;
  const pinned = db.prepare('SELECT COUNT(*) as cnt FROM clipboard_items WHERE pinned = 1').get().cnt;
  const totalChars = db.prepare('SELECT COALESCE(SUM(LENGTH(content)), 0) as total FROM clipboard_items').get().total;
  return { total, pinned, totalChars };
}

function clearOldClips(db, days) {
  if (!days || days < 1) throw new Error('Days must be at least 1');
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const r = db.prepare('DELETE FROM clipboard_items WHERE pinned = 0 AND created_at < ?').run(cutoff);
  return { deleted: r.changes };
}

module.exports = {
  parseTags, saveClip, getClips, getClip, updateClip, deleteClip,
  pinClip, unpinClip, searchClips, getClipStats, clearOldClips,
};
