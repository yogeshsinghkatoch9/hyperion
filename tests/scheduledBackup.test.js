import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock backupService and cronScheduler
vi.mock('../services/backupService', () => ({
  default: {
    createBackup: vi.fn(() => ({ filename: 'hyperion_20260415_120000.db', size: 4096 })),
    cleanOldBackups: vi.fn(() => ({ kept: 3, deleted: 1 })),
  },
  createBackup: vi.fn(() => ({ filename: 'hyperion_20260415_120000.db', size: 4096 })),
  cleanOldBackups: vi.fn(() => ({ kept: 3, deleted: 1 })),
}));

const scheduledBackup = await import('../services/scheduledBackup.js');

function mockDb(settings = {}) {
  const store = { ...settings };
  return {
    prepare: vi.fn((sql) => ({
      get: vi.fn((...args) => {
        const key = args[0];
        return store[key] ? { value: store[key] } : undefined;
      }),
      run: vi.fn((...args) => {
        if (sql.includes('INSERT') || sql.includes('UPDATE')) {
          store[args[0]] = args[1];
        }
      }),
    })),
  };
}

describe('getSetting', () => {
  test('returns fallback when key missing', () => {
    const db = mockDb();
    expect(scheduledBackup.getSetting(db, 'nonexistent', 'default')).toBe('default');
  });

  test('returns stored value', () => {
    const db = mockDb({ 'backup_schedule': '"0 0 * * *"' });
    expect(scheduledBackup.getSetting(db, 'backup_schedule', null)).toBe('0 0 * * *');
  });
});

describe('setSetting', () => {
  test('stores value', () => {
    const db = mockDb();
    scheduledBackup.setSetting(db, 'test_key', 'test_value');
    expect(db.prepare).toHaveBeenCalled();
  });

  test('serializes objects', () => {
    const db = mockDb();
    scheduledBackup.setSetting(db, 'obj_key', { a: 1 });
    expect(db.prepare).toHaveBeenCalled();
  });
});

describe('start / stop', () => {
  afterEach(() => scheduledBackup.stop());

  test('start does not throw', () => {
    const db = mockDb();
    expect(() => scheduledBackup.start(db)).not.toThrow();
  });

  test('stop clears interval', () => {
    const db = mockDb();
    scheduledBackup.start(db);
    expect(() => scheduledBackup.stop()).not.toThrow();
  });

  test('double stop is safe', () => {
    expect(() => scheduledBackup.stop()).not.toThrow();
    expect(() => scheduledBackup.stop()).not.toThrow();
  });
});

describe('checkAndRun', () => {
  test('does nothing without schedule', () => {
    const db = mockDb();
    scheduledBackup.start(db);
    const result = scheduledBackup.checkAndRun();
    expect(result).toBeUndefined();
  });

  test('does nothing with invalid cron', () => {
    const db = mockDb({ 'backup_schedule': '"invalid"' });
    scheduledBackup.start(db);
    const result = scheduledBackup.checkAndRun();
    expect(result).toBeUndefined();
  });
});
