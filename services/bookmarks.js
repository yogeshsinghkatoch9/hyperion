const { v4: uuidv4 } = require('uuid');

// ── URL Validation ──
function isValidUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const u = new URL(urlStr);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ── Favicon URL Builder ──
function getFaviconUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return '';
  try {
    const u = new URL(urlStr);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=32`;
  } catch {
    return '';
  }
}

// ── Parse Tags ──
function parseTags(tags) {
  if (Array.isArray(tags)) return tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed.map(t => String(t).trim().toLowerCase()).filter(Boolean);
    } catch { /* fall through */ }
    return tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

// ── Duplicate Detection ──
function isDuplicate(db, url) {
  const row = db.prepare('SELECT id FROM bookmarks WHERE url = ?').get(url);
  return !!row;
}

// ── Create Bookmark ──
function createBookmark(db, { url, title, description, tags }) {
  if (!url) throw new Error('URL required');
  if (!isValidUrl(url)) throw new Error('Invalid URL');
  if (isDuplicate(db, url)) throw new Error('Bookmark already exists');
  const id = uuidv4();
  const favicon = getFaviconUrl(url);
  const parsedTags = parseTags(tags);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO bookmarks (id, url, title, description, tags, favicon, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, url, title || url, description || '', JSON.stringify(parsedTags), favicon, now);
  return { id, url, title: title || url, tags: parsedTags };
}

// ── Get Bookmarks ──
function getBookmarks(db) {
  return db.prepare('SELECT * FROM bookmarks ORDER BY created_at DESC').all().map(r => ({
    ...r,
    tags: JSON.parse(r.tags || '[]'),
  }));
}

// ── Get Single Bookmark ──
function getBookmark(db, id) {
  const row = db.prepare('SELECT * FROM bookmarks WHERE id = ?').get(id);
  if (!row) throw new Error('Bookmark not found');
  return { ...row, tags: JSON.parse(row.tags || '[]') };
}

// ── Update Bookmark ──
function updateBookmark(db, id, updates) {
  const bm = getBookmark(db, id);
  const url = updates.url !== undefined ? updates.url : bm.url;
  const title = updates.title !== undefined ? updates.title : bm.title;
  const description = updates.description !== undefined ? updates.description : bm.description;
  const tags = updates.tags !== undefined ? JSON.stringify(parseTags(updates.tags)) : JSON.stringify(bm.tags);
  const favicon = updates.url ? getFaviconUrl(updates.url) : bm.favicon;
  db.prepare('UPDATE bookmarks SET url=?, title=?, description=?, tags=?, favicon=? WHERE id=?')
    .run(url, title, description, tags, favicon, id);
  return { id, url, title };
}

// ── Delete Bookmark ──
function deleteBookmark(db, id) {
  const r = db.prepare('DELETE FROM bookmarks WHERE id = ?').run(id);
  if (r.changes === 0) throw new Error('Bookmark not found');
}

// ── Search ──
function searchBookmarks(db, query, tag) {
  let rows;
  if (tag) {
    rows = getBookmarks(db).filter(b => b.tags.includes(tag.toLowerCase()));
  } else if (query) {
    const q = `%${query}%`;
    rows = db.prepare('SELECT * FROM bookmarks WHERE title LIKE ? OR description LIKE ? OR url LIKE ? ORDER BY created_at DESC')
      .all(q, q, q).map(r => ({ ...r, tags: JSON.parse(r.tags || '[]') }));
  } else {
    rows = getBookmarks(db);
  }
  return rows;
}

// ── Tag Listing with Counts ──
function getTags(db) {
  const bookmarks = getBookmarks(db);
  const tagMap = {};
  for (const bm of bookmarks) {
    for (const t of bm.tags) {
      tagMap[t] = (tagMap[t] || 0) + 1;
    }
  }
  return Object.entries(tagMap).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
}

// ── Import / Export ──
function exportBookmarks(db) {
  return getBookmarks(db);
}

function importBookmarks(db, data) {
  if (!Array.isArray(data)) throw new Error('Import data must be an array');
  let imported = 0;
  let skipped = 0;
  for (const item of data) {
    try {
      if (!item.url || !isValidUrl(item.url)) { skipped++; continue; }
      if (isDuplicate(db, item.url)) { skipped++; continue; }
      createBookmark(db, item);
      imported++;
    } catch {
      skipped++;
    }
  }
  return { imported, skipped };
}

module.exports = {
  isValidUrl,
  getFaviconUrl,
  parseTags,
  isDuplicate,
  createBookmark,
  getBookmarks,
  getBookmark,
  updateBookmark,
  deleteBookmark,
  searchBookmarks,
  getTags,
  exportBookmarks,
  importBookmarks,
};
