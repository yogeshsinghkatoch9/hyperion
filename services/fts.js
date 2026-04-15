/**
 * Full-Text Search (FTS5) — index and search across notes, snippets, bookmarks, clipboard
 */
'use strict';

function isFts5Available(db) {
  try {
    db.exec("CREATE VIRTUAL TABLE IF NOT EXISTS _fts_test USING fts5(content)");
    db.exec("DROP TABLE IF EXISTS _fts_test");
    return true;
  } catch {
    return false;
  }
}

function initFtsTables(db) {
  if (!isFts5Available(db)) return false;

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_notes USING fts5(
      id UNINDEXED, title, content, content='quick_notes', content_rowid='rowid'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_snippets USING fts5(
      id UNINDEXED, name, code, content='snippets', content_rowid='rowid'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_bookmarks USING fts5(
      id UNINDEXED, title, description, url, content='bookmarks', content_rowid='rowid'
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_clipboard USING fts5(
      id UNINDEXED, content, label, content='clipboard_items', content_rowid='rowid'
    );
  `);

  // Triggers for notes
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS fts_notes_ai AFTER INSERT ON quick_notes BEGIN
      INSERT INTO fts_notes(rowid, id, title, content) VALUES (new.rowid, new.id, new.title, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_notes_ad AFTER DELETE ON quick_notes BEGIN
      INSERT INTO fts_notes(fts_notes, rowid, id, title, content) VALUES('delete', old.rowid, old.id, old.title, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_notes_au AFTER UPDATE ON quick_notes BEGIN
      INSERT INTO fts_notes(fts_notes, rowid, id, title, content) VALUES('delete', old.rowid, old.id, old.title, old.content);
      INSERT INTO fts_notes(rowid, id, title, content) VALUES (new.rowid, new.id, new.title, new.content);
    END;
  `);

  // Triggers for snippets
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS fts_snippets_ai AFTER INSERT ON snippets BEGIN
      INSERT INTO fts_snippets(rowid, id, name, code) VALUES (new.rowid, new.id, new.name, new.code);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_snippets_ad AFTER DELETE ON snippets BEGIN
      INSERT INTO fts_snippets(fts_snippets, rowid, id, name, code) VALUES('delete', old.rowid, old.id, old.name, old.code);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_snippets_au AFTER UPDATE ON snippets BEGIN
      INSERT INTO fts_snippets(fts_snippets, rowid, id, name, code) VALUES('delete', old.rowid, old.id, old.name, old.code);
      INSERT INTO fts_snippets(rowid, id, name, code) VALUES (new.rowid, new.id, new.name, new.code);
    END;
  `);

  // Triggers for bookmarks
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS fts_bookmarks_ai AFTER INSERT ON bookmarks BEGIN
      INSERT INTO fts_bookmarks(rowid, id, title, description, url) VALUES (new.rowid, new.id, new.title, new.description, new.url);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_bookmarks_ad AFTER DELETE ON bookmarks BEGIN
      INSERT INTO fts_bookmarks(fts_bookmarks, rowid, id, title, description, url) VALUES('delete', old.rowid, old.id, old.title, old.description, old.url);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_bookmarks_au AFTER UPDATE ON bookmarks BEGIN
      INSERT INTO fts_bookmarks(fts_bookmarks, rowid, id, title, description, url) VALUES('delete', old.rowid, old.id, old.title, old.description, old.url);
      INSERT INTO fts_bookmarks(rowid, id, title, description, url) VALUES (new.rowid, new.id, new.title, new.description, new.url);
    END;
  `);

  // Triggers for clipboard
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS fts_clipboard_ai AFTER INSERT ON clipboard_items BEGIN
      INSERT INTO fts_clipboard(rowid, id, content, label) VALUES (new.rowid, new.id, new.content, new.label);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_clipboard_ad AFTER DELETE ON clipboard_items BEGIN
      INSERT INTO fts_clipboard(fts_clipboard, rowid, id, content, label) VALUES('delete', old.rowid, old.id, old.content, old.label);
    END;
    CREATE TRIGGER IF NOT EXISTS fts_clipboard_au AFTER UPDATE ON clipboard_items BEGIN
      INSERT INTO fts_clipboard(fts_clipboard, rowid, id, content, label) VALUES('delete', old.rowid, old.id, old.content, old.label);
      INSERT INTO fts_clipboard(rowid, id, content, label) VALUES (new.rowid, new.id, new.content, new.label);
    END;
  `);

  return true;
}

function rebuildAll(db) {
  const tables = ['fts_notes', 'fts_snippets', 'fts_bookmarks', 'fts_clipboard'];
  for (const t of tables) {
    try {
      db.exec(`INSERT INTO ${t}(${t}) VALUES('rebuild')`);
    } catch {}
  }
}

function sanitizeFtsQuery(query) {
  if (!query) return '';
  // Escape FTS5 special chars, add prefix matching
  const cleaned = query
    .replace(/[*"():^~{}[\]]/g, '')
    .trim();
  if (!cleaned) return '';
  // Add prefix matching for each token
  return cleaned.split(/\s+/).map(w => `"${w}"*`).join(' ');
}

function search(db, query, { limit = 20 } = {}) {
  const ftsQuery = sanitizeFtsQuery(query);
  if (!ftsQuery) return [];

  const results = [];

  // Search notes
  try {
    const notes = db.prepare(
      `SELECT id, highlight(fts_notes, 1, '<mark>', '</mark>') as title,
              highlight(fts_notes, 2, '<mark>', '</mark>') as snippet,
              rank
       FROM fts_notes WHERE fts_notes MATCH ? ORDER BY rank LIMIT ?`
    ).all(ftsQuery, limit);
    for (const n of notes) results.push({ type: 'note', id: n.id, title: n.title, snippet: n.snippet, rank: n.rank });
  } catch {}

  // Search snippets
  try {
    const snippets = db.prepare(
      `SELECT id, highlight(fts_snippets, 1, '<mark>', '</mark>') as name,
              highlight(fts_snippets, 2, '<mark>', '</mark>') as snippet,
              rank
       FROM fts_snippets WHERE fts_snippets MATCH ? ORDER BY rank LIMIT ?`
    ).all(ftsQuery, limit);
    for (const s of snippets) results.push({ type: 'snippet', id: s.id, title: s.name, snippet: s.snippet, rank: s.rank });
  } catch {}

  // Search bookmarks
  try {
    const bookmarks = db.prepare(
      `SELECT id, highlight(fts_bookmarks, 1, '<mark>', '</mark>') as title,
              highlight(fts_bookmarks, 2, '<mark>', '</mark>') as snippet,
              rank
       FROM fts_bookmarks WHERE fts_bookmarks MATCH ? ORDER BY rank LIMIT ?`
    ).all(ftsQuery, limit);
    for (const b of bookmarks) results.push({ type: 'bookmark', id: b.id, title: b.title, snippet: b.snippet, rank: b.rank });
  } catch {}

  // Search clipboard
  try {
    const clips = db.prepare(
      `SELECT id, highlight(fts_clipboard, 1, '<mark>', '</mark>') as snippet,
              highlight(fts_clipboard, 2, '<mark>', '</mark>') as label,
              rank
       FROM fts_clipboard WHERE fts_clipboard MATCH ? ORDER BY rank LIMIT ?`
    ).all(ftsQuery, limit);
    for (const c of clips) results.push({ type: 'clipboard', id: c.id, title: c.label || 'Clipboard', snippet: c.snippet, rank: c.rank });
  } catch {}

  // Sort by rank (lower = better match in FTS5)
  results.sort((a, b) => a.rank - b.rank);
  return results.slice(0, limit);
}

module.exports = { isFts5Available, initFtsTables, rebuildAll, sanitizeFtsQuery, search };
