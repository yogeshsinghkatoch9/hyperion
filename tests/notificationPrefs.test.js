import { describe, test, expect, vi } from 'vitest';

const { notify, SOURCE_TO_CATEGORY } = await import('../services/notify.js');

// ── Basic notify ──
describe('notify', () => {
  function mockDb(prefEnabled = undefined) {
    return {
      prepare: vi.fn((sql) => ({
        run: vi.fn(),
        get: vi.fn(() => prefEnabled !== undefined ? { enabled: prefEnabled } : undefined),
      })),
    };
  }

  test('inserts notification', () => {
    const db = mockDb();
    const id = notify(db, { title: 'Test', message: 'Hello' });
    expect(id).toBeTruthy();
    expect(db.prepare).toHaveBeenCalled();
  });

  test('returns id string', () => {
    const db = mockDb();
    const id = notify(db, { title: 'T', message: 'M', source: 'agent', level: 'success' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('default source and level', () => {
    const db = mockDb();
    notify(db, { title: 'T' });
    const runCall = db.prepare.mock.results.find(r => r.value.run.mock.calls.length > 0);
    expect(runCall).toBeTruthy();
  });
});

// ── SOURCE_TO_CATEGORY mapping ──
describe('SOURCE_TO_CATEGORY', () => {
  test('maps agent to agent_complete', () => {
    expect(SOURCE_TO_CATEGORY.agent).toBe('agent_complete');
  });

  test('maps workflow to workflow_complete', () => {
    expect(SOURCE_TO_CATEGORY.workflow).toBe('workflow_complete');
  });

  test('maps backup to backup_complete', () => {
    expect(SOURCE_TO_CATEGORY.backup).toBe('backup_complete');
  });

  test('maps system to system_alert', () => {
    expect(SOURCE_TO_CATEGORY.system).toBe('system_alert');
  });

  test('maps security to security_alert', () => {
    expect(SOURCE_TO_CATEGORY.security).toBe('security_alert');
  });
});

// ── Preference filtering ──
describe('Notification preferences', () => {
  test('skips notification when user disabled category', () => {
    const db = {
      prepare: vi.fn((sql) => ({
        run: vi.fn(),
        get: vi.fn(() => ({ enabled: 0 })),
      })),
    };
    const id = notify(db, { title: 'Agent done', source: 'agent', userId: 'u1' });
    expect(id).toBeNull();
  });

  test('allows notification when enabled', () => {
    const db = {
      prepare: vi.fn((sql) => ({
        run: vi.fn(),
        get: vi.fn(() => ({ enabled: 1 })),
      })),
    };
    const id = notify(db, { title: 'Agent done', source: 'agent', userId: 'u1' });
    expect(id).toBeTruthy();
  });

  test('allows notification when no preference set', () => {
    const db = {
      prepare: vi.fn((sql) => ({
        run: vi.fn(),
        get: vi.fn(() => undefined),
      })),
    };
    const id = notify(db, { title: 'Agent done', source: 'agent', userId: 'u1' });
    expect(id).toBeTruthy();
  });

  test('skips preference check when no userId', () => {
    const db = {
      prepare: vi.fn((sql) => ({
        run: vi.fn(),
        get: vi.fn(() => ({ enabled: 0 })),
      })),
    };
    // No userId means no preference check — always insert
    const id = notify(db, { title: 'System', source: 'system' });
    expect(id).toBeTruthy();
  });
});
