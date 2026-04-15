const { v4: uuidv4 } = require('uuid');

// ── Extract Title (first H1) ──
function extractTitle(md) {
  if (!md || typeof md !== 'string') return '';
  const match = md.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : '';
}

// ── Extract All Headings for TOC ──
function extractHeadings(md) {
  if (!md || typeof md !== 'string') return [];
  const headings = [];
  const lines = md.split('\n');
  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      headings.push({ level: m[1].length, text: m[2].trim() });
    }
  }
  return headings;
}

// ── Word & Char Count ──
function wordCount(md) {
  if (!md || typeof md !== 'string') return 0;
  const text = md.replace(/[#*_`~\[\]()>|\\-]/g, ' ').trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(w => w.length > 0).length;
}

function charCount(md) {
  if (!md || typeof md !== 'string') return 0;
  return md.length;
}

// ── Read Time Estimate (200 wpm) ──
function readTime(md) {
  const words = wordCount(md);
  const minutes = Math.ceil(words / 200);
  return Math.max(1, minutes);
}

// ── Stats ──
function getDocStats(md) {
  return {
    words: wordCount(md),
    chars: charCount(md),
    readTime: readTime(md),
    headings: extractHeadings(md).length,
    lines: md ? md.split('\n').length : 0,
  };
}

// ── Regex-based Markdown → HTML ──
function markdownToHtml(md) {
  if (!md || typeof md !== 'string') return '';
  let html = md;

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${escapeHtml(code.trim())}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

  // Horizontal rule
  html = html.replace(/^---+$/gm, '<hr>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');

  // Paragraphs — wrap remaining plain lines
  const lines = html.split('\n');
  const result = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { result.push(''); continue; }
    if (/^<[a-z]/.test(trimmed)) { result.push(trimmed); continue; }
    result.push(`<p>${trimmed}</p>`);
  }

  return result.join('\n');
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── HTML Export Template ──
function exportHtml(md, title) {
  const bodyHtml = markdownToHtml(md);
  const docTitle = title || extractTitle(md) || 'Untitled';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${escapeHtml(docTitle)}</title>
<style>
body{font-family:-apple-system,system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.6}
h1,h2,h3,h4,h5,h6{margin-top:1.5em;margin-bottom:0.5em}
code{background:#f4f4f4;padding:2px 6px;border-radius:3px;font-size:0.9em}
pre{background:#f4f4f4;padding:16px;border-radius:6px;overflow-x:auto}
pre code{background:none;padding:0}
blockquote{border-left:4px solid #ddd;margin:0;padding:0 16px;color:#555}
hr{border:none;border-top:1px solid #ddd;margin:2em 0}
a{color:#0066cc}
img{max-width:100%}
</style></head><body>${bodyHtml}</body></html>`;
}

// ── Saved Notes CRUD ──
function createNote(db, { title, content }) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const noteTitle = title || extractTitle(content) || 'Untitled';
  db.prepare('INSERT INTO md_notes (id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, noteTitle, content || '', now, now);
  return { id, title: noteTitle };
}

function getNotes(db) {
  return db.prepare('SELECT * FROM md_notes ORDER BY updated_at DESC').all();
}

function getNote(db, id) {
  const row = db.prepare('SELECT * FROM md_notes WHERE id = ?').get(id);
  if (!row) throw new Error('Note not found');
  return row;
}

function updateNote(db, id, updates) {
  const note = getNote(db, id);
  const title = updates.title !== undefined ? updates.title : note.title;
  const content = updates.content !== undefined ? updates.content : note.content;
  const now = new Date().toISOString();
  db.prepare('UPDATE md_notes SET title=?, content=?, updated_at=? WHERE id=?')
    .run(title, content, now, id);
  return { id, title, content };
}

function deleteNote(db, id) {
  const r = db.prepare('DELETE FROM md_notes WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Note not found');
}

function searchNotes(db, query) {
  if (!query) return getNotes(db);
  const q = `%${query}%`;
  return db.prepare('SELECT * FROM md_notes WHERE title LIKE ? OR content LIKE ? ORDER BY updated_at DESC')
    .all(q, q);
}

module.exports = {
  extractTitle,
  extractHeadings,
  wordCount,
  charCount,
  readTime,
  getDocStats,
  markdownToHtml,
  exportHtml,
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
  searchNotes,
};
