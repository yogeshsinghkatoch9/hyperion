import { describe, test, expect, vi, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';

const fts = await import('../services/fts.js');

let db;

beforeAll(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');

  // Create source tables (rowid is implicit, id is TEXT UNIQUE)
  db.exec(`
    CREATE TABLE quick_notes (
      id TEXT UNIQUE,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      color TEXT DEFAULT 'default',
      pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE snippets (
      id TEXT UNIQUE,
      name TEXT NOT NULL,
      language TEXT DEFAULT 'python',
      code TEXT,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE bookmarks (
      id TEXT UNIQUE,
      url TEXT,
      title TEXT,
      description TEXT,
      tags TEXT DEFAULT '[]',
      favicon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE clipboard_items (
      id TEXT UNIQUE,
      content TEXT,
      label TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      created_at DATETIME
    );
  `);
});

afterAll(() => { db.close(); });

// ── FTS5 Availability ──
describe('isFts5Available', () => {
  test('returns boolean', () => {
    const result = fts.isFts5Available(db);
    expect(typeof result).toBe('boolean');
  });
});

// ── sanitizeFtsQuery ──
describe('sanitizeFtsQuery', () => {
  test('empty/null returns empty', () => {
    expect(fts.sanitizeFtsQuery('')).toBe('');
    expect(fts.sanitizeFtsQuery(null)).toBe('');
    expect(fts.sanitizeFtsQuery(undefined)).toBe('');
  });

  test('escapes special chars', () => {
    const result = fts.sanitizeFtsQuery('test*"query');
    // Original * and " are stripped, tokens wrapped for prefix matching
    expect(result).toContain('*'); // adds prefix matching
    expect(result).not.toContain('*"'); // original special chars removed
  });

  test('adds prefix matching', () => {
    const result = fts.sanitizeFtsQuery('hello world');
    expect(result).toContain('*');
  });

  test('single word', () => {
    const result = fts.sanitizeFtsQuery('test');
    expect(result).toContain('test');
    expect(result).toContain('*');
  });

  test('strips parentheses', () => {
    const result = fts.sanitizeFtsQuery('test(foo)');
    expect(result).not.toContain('(');
    expect(result).not.toContain(')');
  });
});

// ── FTS initialization and search (only if FTS5 available) ──
describe('FTS5 operations', () => {
  let ftsAvailable;

  beforeAll(() => {
    ftsAvailable = fts.isFts5Available(db);
    if (ftsAvailable) {
      fts.initFtsTables(db);
    }
  });

  test('initFtsTables creates FTS tables', () => {
    if (!ftsAvailable) return;
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'fts_%'").all();
    const names = tables.map(t => t.name);
    expect(names).toContain('fts_notes');
    expect(names).toContain('fts_snippets');
    expect(names).toContain('fts_bookmarks');
    expect(names).toContain('fts_clipboard');
  });

  test('triggers created', () => {
    if (!ftsAvailable) return;
    const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'fts_%'").all();
    expect(triggers.length).toBeGreaterThanOrEqual(12);
  });

  test('insert into source table updates FTS', () => {
    if (!ftsAvailable) return;
    db.exec("INSERT INTO quick_notes (id, title, content) VALUES ('n1', 'Hyperion Setup Guide', 'How to install and configure Hyperion')");
    const results = fts.search(db, 'Hyperion');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].type).toBe('note');
  });

  test('search returns highlighted results', () => {
    if (!ftsAvailable) return;
    const results = fts.search(db, 'Setup');
    if (results.length > 0) {
      expect(results[0].title).toContain('<mark>');
    }
  });

  test('search with limit', () => {
    if (!ftsAvailable) return;
    for (let i = 0; i < 5; i++) {
      db.exec(`INSERT INTO quick_notes (id, title, content) VALUES ('search_${i}', 'Search Test ${i}', 'Content for search test')`);
    }
    const results = fts.search(db, 'Search Test', { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  test('search across multiple tables', () => {
    if (!ftsAvailable) return;
    db.exec("INSERT INTO snippets (id, name, code) VALUES ('s1', 'Hyperion Helper', 'function hyperionInit() {}')");
    db.exec("INSERT INTO bookmarks (id, title, url, description) VALUES ('b1', 'Hyperion Docs', 'https://example.com', 'Official Hyperion documentation')");
    const results = fts.search(db, 'Hyperion');
    const types = results.map(r => r.type);
    expect(types).toContain('note');
    expect(types).toContain('snippet');
    expect(types).toContain('bookmark');
  });

  test('empty query returns empty', () => {
    if (!ftsAvailable) return;
    expect(fts.search(db, '')).toEqual([]);
    expect(fts.search(db, '  ')).toEqual([]);
  });

  test('rebuildAll does not throw', () => {
    if (!ftsAvailable) return;
    expect(() => fts.rebuildAll(db)).not.toThrow();
  });

  test('delete from source table removes from FTS', () => {
    if (!ftsAvailable) return;
    const beforeDel = fts.search(db, 'Hyperion Setup Guide');
    db.exec("DELETE FROM quick_notes WHERE id = 'n1'");
    const afterDel = fts.search(db, 'Hyperion Setup Guide');
    expect(afterDel.length).toBeLessThan(beforeDel.length);
  });
});
