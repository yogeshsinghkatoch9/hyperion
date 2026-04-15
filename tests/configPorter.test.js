import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const configPorter = require('../services/configPorter');

function createTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    );
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      language TEXT DEFAULT 'python',
      code TEXT,
      tags TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id TEXT PRIMARY KEY,
      url TEXT,
      title TEXT,
      description TEXT,
      tags TEXT DEFAULT '[]',
      favicon TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workflow_profiles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      actions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS cron_presets (
      id TEXT PRIMARY KEY,
      name TEXT,
      expression TEXT,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
}

function seedData(db) {
  db.prepare("INSERT INTO settings (user_id, key, value) VALUES ('u1', 'theme', 'dark')").run();
  db.prepare("INSERT INTO settings (user_id, key, value) VALUES ('u1', 'lang', 'en')").run();
  db.prepare("INSERT INTO snippets (id, name, language, code) VALUES ('s1', 'Hello', 'python', 'print(1)')").run();
  db.prepare("INSERT INTO bookmarks (id, url, title) VALUES ('b1', 'https://test.com', 'Test')").run();
}

describe('configPorter', () => {
  let db;
  beforeEach(() => { db = createTestDB(); });

  describe('EXPORTABLE_TABLES', () => {
    it('has expected tables', () => {
      expect(configPorter.EXPORTABLE_TABLES).toContain('settings');
      expect(configPorter.EXPORTABLE_TABLES).toContain('snippets');
      expect(configPorter.EXPORTABLE_TABLES).toContain('bookmarks');
      expect(configPorter.EXPORTABLE_TABLES).not.toContain('users');
    });
  });

  describe('isValidTable', () => {
    it('accepts valid tables', () => {
      expect(configPorter.isValidTable('settings')).toBe(true);
      expect(configPorter.isValidTable('snippets')).toBe(true);
    });

    it('rejects invalid tables', () => {
      expect(configPorter.isValidTable('users')).toBe(false);
      expect(configPorter.isValidTable('audit_logs')).toBe(false);
      expect(configPorter.isValidTable('DROP TABLE')).toBe(false);
    });
  });

  describe('exportConfig', () => {
    it('exports all tables by default', () => {
      seedData(db);
      const data = configPorter.exportConfig(db);
      expect(data._meta).toBeDefined();
      expect(data._meta.version).toBe(1);
      expect(data.settings).toHaveLength(2);
      expect(data.snippets).toHaveLength(1);
    });

    it('exports selected tables only', () => {
      seedData(db);
      const data = configPorter.exportConfig(db, ['snippets']);
      expect(data.snippets).toHaveLength(1);
      expect(data.settings).toBeUndefined();
    });

    it('ignores invalid table names', () => {
      const data = configPorter.exportConfig(db, ['users', 'settings']);
      expect(data.users).toBeUndefined();
      expect(data.settings).toBeDefined();
    });

    it('includes _meta with export timestamp', () => {
      const data = configPorter.exportConfig(db, ['settings']);
      expect(data._meta.exportedAt).toBeTruthy();
      expect(data._meta.tables).toEqual(['settings']);
    });
  });

  describe('importConfig (merge mode)', () => {
    it('imports new records', () => {
      const data = {
        _meta: { version: 1, exportedAt: '2024-01-01', tables: ['snippets'] },
        snippets: [{ id: 's1', name: 'New', language: 'js', code: 'console.log(1)' }],
      };
      const results = configPorter.importConfig(db, data, 'merge');
      expect(results.snippets.imported).toBe(1);
      const row = db.prepare('SELECT * FROM snippets WHERE id = ?').get('s1');
      expect(row.name).toBe('New');
    });

    it('skips existing records in merge mode', () => {
      seedData(db);
      const data = {
        _meta: { version: 1, exportedAt: '2024-01-01', tables: ['snippets'] },
        snippets: [{ id: 's1', name: 'Updated', language: 'js', code: 'new code' }],
      };
      configPorter.importConfig(db, data, 'merge');
      const row = db.prepare('SELECT * FROM snippets WHERE id = ?').get('s1');
      expect(row.name).toBe('Hello'); // Not updated in merge
    });

    it('throws on missing _meta', () => {
      expect(() => configPorter.importConfig(db, { snippets: [] })).toThrow('Missing _meta');
    });

    it('throws on invalid data', () => {
      expect(() => configPorter.importConfig(db, null)).toThrow('Invalid import data');
    });
  });

  describe('importConfig (overwrite mode)', () => {
    it('replaces existing data', () => {
      seedData(db);
      const data = {
        _meta: { version: 1, exportedAt: '2024-01-01', tables: ['snippets'] },
        snippets: [{ id: 's2', name: 'Replaced', language: 'py', code: 'pass' }],
      };
      configPorter.importConfig(db, data, 'overwrite');
      const all = db.prepare('SELECT * FROM snippets').all();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe('s2');
    });
  });

  describe('exportTableCsv', () => {
    it('generates valid CSV', () => {
      seedData(db);
      const csv = configPorter.exportTableCsv(db, 'snippets');
      const lines = csv.split('\n');
      expect(lines[0]).toContain('id');
      expect(lines[0]).toContain('name');
      expect(lines).toHaveLength(2); // header + 1 row
    });

    it('returns empty string for empty table', () => {
      const csv = configPorter.exportTableCsv(db, 'snippets');
      expect(csv).toBe('');
    });

    it('throws for invalid table', () => {
      expect(() => configPorter.exportTableCsv(db, 'users')).toThrow('not exportable');
    });

    it('escapes CSV special characters', () => {
      db.prepare("INSERT INTO snippets (id, name, language, code) VALUES ('s1', 'test, with comma', 'py', 'x=\"hello\"')").run();
      const csv = configPorter.exportTableCsv(db, 'snippets');
      expect(csv).toContain('"test, with comma"');
    });
  });
});
