const { v4: uuidv4 } = require('uuid');

const VALID_COLORS = ['default', 'red', 'green', 'blue', 'amber', 'purple'];

// ── Color Validation ──
function isValidColor(color) {
  return VALID_COLORS.includes(color);
}

// ── Create Note ──
function createNote(db, { title, content, color }) {
  if (!title && !content) throw new Error('Title or content required');
  const noteColor = color && isValidColor(color) ? color : 'default';
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO quick_notes (id, title, content, color, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
    .run(id, title || '', content || '', noteColor, now, now);
  return { id, title: title || '', color: noteColor };
}

// ── Get Notes (pinned first, then by updated_at) ──
function getNotes(db) {
  return db.prepare('SELECT * FROM quick_notes ORDER BY pinned DESC, updated_at DESC').all();
}

// ── Get Single Note ──
function getNote(db, id) {
  const row = db.prepare('SELECT * FROM quick_notes WHERE id = ?').get(id);
  if (!row) throw new Error('Note not found');
  return row;
}

// ── Update Note ──
function updateNote(db, id, updates) {
  const note = getNote(db, id);
  const title = updates.title !== undefined ? updates.title : note.title;
  const content = updates.content !== undefined ? updates.content : note.content;
  const color = updates.color !== undefined && isValidColor(updates.color) ? updates.color : note.color;
  const now = new Date().toISOString();
  db.prepare('UPDATE quick_notes SET title=?, content=?, color=?, updated_at=? WHERE id=?')
    .run(title, content, color, now, id);
  return { id, title, color };
}

// ── Delete Note ──
function deleteNote(db, id) {
  const r = db.prepare('DELETE FROM quick_notes WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Note not found');
}

// ── Pin / Unpin ──
function togglePin(db, id) {
  const note = getNote(db, id);
  const newPinned = note.pinned ? 0 : 1;
  db.prepare('UPDATE quick_notes SET pinned = ?, updated_at = ? WHERE id = ?')
    .run(newPinned, new Date().toISOString(), id);
  return { id, pinned: !!newPinned };
}

// ── Search ──
function searchNotes(db, query) {
  if (!query) return getNotes(db);
  const q = `%${query}%`;
  return db.prepare('SELECT * FROM quick_notes WHERE title LIKE ? OR content LIKE ? ORDER BY pinned DESC, updated_at DESC')
    .all(q, q);
}

// ── Defaults ──
function getDefaults() {
  return { color: 'default', pinned: false, colors: VALID_COLORS };
}

module.exports = {
  VALID_COLORS,
  isValidColor,
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
  togglePin,
  searchNotes,
  getDefaults,
};
