import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const { saveVersion, listVersions, getVersion, diffVersions, restoreVersion, deleteVersion, pruneVersions, getVersionedFiles, hashContent, MAX_VERSIONS_PER_FILE } = await import('../services/fileVersioning.js');

describe('File Versioning', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS file_versions (
        id TEXT PRIMARY KEY, file_path TEXT NOT NULL, content TEXT,
        size INTEGER DEFAULT 0, hash TEXT, reason TEXT DEFAULT 'edit',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_file_versions_path ON file_versions(file_path);
    `);
  });

  describe('hashContent', () => {
    it('returns consistent hash for same content', () => {
      const h1 = hashContent('hello world');
      const h2 = hashContent('hello world');
      expect(h1).toBe(h2);
      expect(h1.length).toBe(16);
    });

    it('returns different hash for different content', () => {
      expect(hashContent('a')).not.toBe(hashContent('b'));
    });

    it('handles empty content', () => {
      expect(hashContent('')).toBeTruthy();
    });
  });

  describe('saveVersion', () => {
    it('saves a new version', () => {
      const v = saveVersion(db, '/tmp/test.js', 'const x = 1;', 'edit');
      expect(v).not.toBeNull();
      expect(v.id).toBeDefined();
      expect(v.filePath).toBe('/tmp/test.js');
      expect(v.reason).toBe('edit');
    });

    it('skips duplicate content', () => {
      saveVersion(db, '/tmp/test.js', 'const x = 1;');
      const v2 = saveVersion(db, '/tmp/test.js', 'const x = 1;');
      expect(v2).toBeNull();
    });

    it('saves when content changes', () => {
      saveVersion(db, '/tmp/test.js', 'v1');
      const v2 = saveVersion(db, '/tmp/test.js', 'v2');
      expect(v2).not.toBeNull();
    });
  });

  describe('listVersions', () => {
    it('returns versions for a file', () => {
      saveVersion(db, '/tmp/a.js', 'v1');
      saveVersion(db, '/tmp/a.js', 'v2');
      saveVersion(db, '/tmp/b.js', 'other');
      const versions = listVersions(db, '/tmp/a.js');
      expect(versions.length).toBe(2);
    });

    it('respects limit', () => {
      for (let i = 0; i < 10; i++) saveVersion(db, '/tmp/a.js', `v${i}`);
      const versions = listVersions(db, '/tmp/a.js', 3);
      expect(versions.length).toBe(3);
    });

    it('does not include content in list', () => {
      saveVersion(db, '/tmp/a.js', 'hello');
      const versions = listVersions(db, '/tmp/a.js');
      expect(versions[0].content).toBeUndefined();
    });
  });

  describe('getVersion', () => {
    it('returns full version with content', () => {
      const v = saveVersion(db, '/tmp/a.js', 'full content');
      const got = getVersion(db, v.id);
      expect(got.content).toBe('full content');
      expect(got.file_path).toBe('/tmp/a.js');
    });

    it('throws if not found', () => {
      expect(() => getVersion(db, 'nope')).toThrow('Version not found');
    });
  });

  describe('diffVersions', () => {
    it('diffs two versions', () => {
      const v1 = saveVersion(db, '/tmp/a.js', 'line1\nline2\nline3');
      const v2 = saveVersion(db, '/tmp/a.js', 'line1\nchanged\nline3');
      const diff = diffVersions(db, v1.id, v2.id);
      expect(diff.versionA.id).toBe(v1.id);
      expect(diff.versionB.id).toBe(v2.id);
      expect(diff.stats.added).toBeGreaterThan(0);
      expect(diff.stats.removed).toBeGreaterThan(0);
    });

    it('shows no changes for identical content', () => {
      const v1 = saveVersion(db, '/tmp/a.js', 'same');
      // Force a second version with different reason
      db.prepare("INSERT INTO file_versions (id, file_path, content, size, hash, reason) VALUES ('v2id', '/tmp/a.js', 'same', 4, 'x', 'manual')").run();
      const diff = diffVersions(db, v1.id, 'v2id');
      expect(diff.changes.length).toBe(0);
    });
  });

  describe('restoreVersion', () => {
    it('returns content for restore', () => {
      const v = saveVersion(db, '/tmp/a.js', 'restore me');
      const result = restoreVersion(db, v.id);
      expect(result.filePath).toBe('/tmp/a.js');
      expect(result.content).toBe('restore me');
    });
  });

  describe('deleteVersion', () => {
    it('deletes a version', () => {
      const v = saveVersion(db, '/tmp/a.js', 'delete me');
      const result = deleteVersion(db, v.id);
      expect(result.deleted).toBe(true);
    });

    it('throws if not found', () => {
      expect(() => deleteVersion(db, 'nope')).toThrow('Version not found');
    });
  });

  describe('pruneVersions', () => {
    it('prunes beyond MAX_VERSIONS_PER_FILE', () => {
      for (let i = 0; i < MAX_VERSIONS_PER_FILE + 5; i++) {
        db.prepare("INSERT INTO file_versions (id, file_path, content, size, hash, reason) VALUES (?, '/tmp/a.js', ?, ?, ?, 'edit')")
          .run(`id_${i}`, `content_${i}`, i, `hash_${i}`);
      }
      pruneVersions(db, '/tmp/a.js');
      const remaining = db.prepare("SELECT COUNT(*) as c FROM file_versions WHERE file_path = '/tmp/a.js'").get().c;
      expect(remaining).toBe(MAX_VERSIONS_PER_FILE);
    });
  });

  describe('getVersionedFiles', () => {
    it('lists files with version counts', () => {
      saveVersion(db, '/tmp/a.js', 'v1');
      saveVersion(db, '/tmp/a.js', 'v2');
      saveVersion(db, '/tmp/b.js', 'v1');
      const files = getVersionedFiles(db);
      expect(files.length).toBe(2);
      const fileA = files.find(f => f.file_path === '/tmp/a.js');
      expect(fileA.version_count).toBe(2);
    });
  });

  describe('constants', () => {
    it('has MAX_VERSIONS_PER_FILE', () => {
      expect(MAX_VERSIONS_PER_FILE).toBe(50);
    });
  });
});
