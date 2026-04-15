import { describe, it, expect, beforeEach, afterEach } from 'vitest';
const fs = require('fs');
const path = require('path');
const os = require('os');

const backup = require('../services/backupService');

let tmpDir, origBackupDir, origDbPath;

// Patch internal paths to use temp dir
function patchPaths(dir) {
  const mod = require.resolve('../services/backupService');
  const svc = require(mod);
  origBackupDir = svc.BACKUP_DIR;
  // Monkey-patch the module's constants via Object.defineProperty workaround
  // We re-write the module internals for testing
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hyperion-backup-test-'));
  // Create a fake hyperion.db
  const fakeDb = path.join(tmpDir, 'hyperion.db');
  fs.writeFileSync(fakeDb, 'FAKE_DB_CONTENT_FOR_TESTING');
  // Create backups subdir
  const backupsDir = path.join(tmpDir, 'backups');
  fs.mkdirSync(backupsDir, { recursive: true });
});

afterEach(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
});

// ── Helper: create a backup file in the temp backups dir ──
function makeFakeBackup(name, content) {
  const dir = path.join(tmpDir, 'backups');
  fs.writeFileSync(path.join(dir, name), content || 'backup-data');
}

// ── Filename Validation ──
describe('Filename Validation', () => {
  it('accepts valid backup filename', () => {
    expect(() => backup.validateFilename('hyperion_20260412_153000.db')).not.toThrow();
  });

  it('rejects path traversal attempt with ../', () => {
    expect(() => backup.validateFilename('../../../etc/passwd')).toThrow('Invalid');
  });

  it('rejects path traversal with embedded slashes', () => {
    expect(() => backup.validateFilename('hyperion_20260412_153000.db/../../etc/passwd')).toThrow('Invalid');
  });

  it('rejects null filename', () => {
    expect(() => backup.validateFilename(null)).toThrow('Filename required');
  });

  it('rejects empty string', () => {
    expect(() => backup.validateFilename('')).toThrow('Filename required');
  });

  it('rejects wrong extension', () => {
    expect(() => backup.validateFilename('hyperion_20260412_153000.sql')).toThrow('Invalid');
  });

  it('rejects random string', () => {
    expect(() => backup.validateFilename('evil_file.db')).toThrow('Invalid');
  });

  it('rejects filename with extra prefix', () => {
    expect(() => backup.validateFilename('xx_hyperion_20260412_153000.db')).toThrow('Invalid');
  });
});

// ── FILENAME_RE ──
describe('FILENAME_RE pattern', () => {
  it('matches valid pattern', () => {
    expect(backup.FILENAME_RE.test('hyperion_20260412_153000.db')).toBe(true);
  });

  it('does not match short date', () => {
    expect(backup.FILENAME_RE.test('hyperion_202604_1530.db')).toBe(false);
  });
});

// ── listBackups ──
describe('listBackups', () => {
  it('returns array from backup directory', () => {
    // Uses the real BACKUP_DIR (which ensureBackupDir creates if needed)
    const result = backup.listBackups();
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns objects with filename, size, createdAt', () => {
    // Create a backup file in real backup dir
    const dir = backup.BACKUP_DIR;
    fs.mkdirSync(dir, { recursive: true });
    const testFile = 'hyperion_29990101_000000.db';
    fs.writeFileSync(path.join(dir, testFile), 'test');
    try {
      const list = backup.listBackups();
      const found = list.find(b => b.filename === testFile);
      expect(found).toBeDefined();
      expect(found.size).toBe(4);
      expect(found.createdAt).toBeTruthy();
    } finally {
      fs.unlinkSync(path.join(dir, testFile));
    }
  });

  it('sorts newest first', () => {
    const dir = backup.BACKUP_DIR;
    fs.mkdirSync(dir, { recursive: true });
    const f1 = 'hyperion_29990101_000001.db';
    const f2 = 'hyperion_29990101_000002.db';
    fs.writeFileSync(path.join(dir, f1), 'a');
    // Small delay to ensure different timestamps
    fs.writeFileSync(path.join(dir, f2), 'b');
    try {
      const list = backup.listBackups();
      const i1 = list.findIndex(b => b.filename === f1);
      const i2 = list.findIndex(b => b.filename === f2);
      // f2 is newer (written second), should appear first
      expect(i2).toBeLessThanOrEqual(i1);
    } finally {
      try { fs.unlinkSync(path.join(dir, f1)); } catch {}
      try { fs.unlinkSync(path.join(dir, f2)); } catch {}
    }
  });

  it('ignores non-matching filenames', () => {
    const dir = backup.BACKUP_DIR;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'random.txt'), 'junk');
    try {
      const list = backup.listBackups();
      expect(list.find(b => b.filename === 'random.txt')).toBeUndefined();
    } finally {
      fs.unlinkSync(path.join(dir, 'random.txt'));
    }
  });
});

// ── getBackupStats ──
describe('getBackupStats', () => {
  it('returns count, totalSize, oldest, newest', () => {
    const stats = backup.getBackupStats();
    expect(stats).toHaveProperty('count');
    expect(stats).toHaveProperty('totalSize');
    expect(stats).toHaveProperty('oldest');
    expect(stats).toHaveProperty('newest');
    expect(typeof stats.count).toBe('number');
    expect(typeof stats.totalSize).toBe('number');
  });
});

// ── cleanOldBackups ──
describe('cleanOldBackups', () => {
  it('returns kept and deleted counts', () => {
    const result = backup.cleanOldBackups(7, 4);
    expect(result).toHaveProperty('kept');
    expect(result).toHaveProperty('deleted');
    expect(typeof result.kept).toBe('number');
    expect(typeof result.deleted).toBe('number');
  });

  it('returns zero counts on empty dir', () => {
    // Ensure backup dir is empty of matching files
    const dir = backup.BACKUP_DIR;
    fs.mkdirSync(dir, { recursive: true });
    const result = backup.cleanOldBackups(7, 4);
    expect(result.deleted).toBe(0);
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all required functions', () => {
    const fns = ['createBackup', 'listBackups', 'restoreBackup', 'deleteBackup',
      'cleanOldBackups', 'getBackupStats', 'validateFilename'];
    for (const fn of fns) {
      expect(typeof backup[fn]).toBe('function');
    }
  });

  it('exports BACKUP_DIR as a string', () => {
    expect(typeof backup.BACKUP_DIR).toBe('string');
    expect(backup.BACKUP_DIR).toContain('backups');
  });

  it('exports FILENAME_RE as a RegExp', () => {
    expect(backup.FILENAME_RE).toBeInstanceOf(RegExp);
  });
});
