import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const { createSubscription, listSubscriptions, getSubscription, updateSubscription, deleteSubscription, signPayload, dispatch, getDeliveries, getRecentDeliveries } = await import('../services/webhookDispatcher.js');

describe('Webhook Dispatcher', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_subscriptions (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL,
        events TEXT DEFAULT '["*"]', headers TEXT DEFAULT '{}',
        secret TEXT, active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL,
        event TEXT NOT NULL, payload TEXT, status_code INTEGER,
        response TEXT, duration_ms INTEGER, success INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  describe('createSubscription', () => {
    it('creates a subscription', () => {
      const sub = createSubscription(db, { name: 'Test', url: 'https://example.com/hook' });
      expect(sub.id).toBeDefined();
      expect(sub.name).toBe('Test');
      expect(sub.url).toBe('https://example.com/hook');
      expect(sub.events).toEqual(['*']);
      expect(sub.active).toBe(true);
    });

    it('creates with custom events', () => {
      const sub = createSubscription(db, { name: 'Build', url: 'https://ci.example.com', events: ['agent.complete', 'backup.done'] });
      expect(sub.events).toEqual(['agent.complete', 'backup.done']);
    });

    it('throws if name missing', () => {
      expect(() => createSubscription(db, { url: 'https://example.com' })).toThrow();
    });

    it('throws if url missing', () => {
      expect(() => createSubscription(db, { name: 'Test' })).toThrow();
    });
  });

  describe('listSubscriptions', () => {
    it('returns all subscriptions', () => {
      createSubscription(db, { name: 'A', url: 'https://a.com/hook' });
      createSubscription(db, { name: 'B', url: 'https://b.com/hook' });
      const list = listSubscriptions(db);
      expect(list.length).toBe(2);
      expect(list[0].events).toBeInstanceOf(Array);
    });
  });

  describe('getSubscription', () => {
    it('returns a subscription', () => {
      const sub = createSubscription(db, { name: 'Test', url: 'https://example.com/hook' });
      const got = getSubscription(db, sub.id);
      expect(got.name).toBe('Test');
    });

    it('throws if not found', () => {
      expect(() => getSubscription(db, 'nope')).toThrow('Subscription not found');
    });
  });

  describe('updateSubscription', () => {
    it('updates name', () => {
      const sub = createSubscription(db, { name: 'Old', url: 'https://example.com/hook' });
      updateSubscription(db, sub.id, { name: 'New' });
      const got = getSubscription(db, sub.id);
      expect(got.name).toBe('New');
    });

    it('updates active status', () => {
      const sub = createSubscription(db, { name: 'Test', url: 'https://example.com/hook' });
      updateSubscription(db, sub.id, { active: false });
      const got = getSubscription(db, sub.id);
      expect(got.active).toBe(0);
    });

    it('updates events', () => {
      const sub = createSubscription(db, { name: 'Test', url: 'https://example.com/hook' });
      updateSubscription(db, sub.id, { events: ['backup.done'] });
      const got = getSubscription(db, sub.id);
      expect(got.events).toEqual(['backup.done']);
    });
  });

  describe('deleteSubscription', () => {
    it('deletes a subscription', () => {
      const sub = createSubscription(db, { name: 'Test', url: 'https://example.com/hook' });
      const result = deleteSubscription(db, sub.id);
      expect(result.deleted).toBe(true);
      expect(listSubscriptions(db).length).toBe(0);
    });

    it('throws if not found', () => {
      expect(() => deleteSubscription(db, 'nope')).toThrow('Subscription not found');
    });
  });

  describe('signPayload', () => {
    it('produces consistent HMAC', () => {
      const sig1 = signPayload('{"test":true}', 'secret123');
      const sig2 = signPayload('{"test":true}', 'secret123');
      expect(sig1).toBe(sig2);
      expect(sig1.length).toBe(64); // hex sha256
    });

    it('produces different HMAC for different secrets', () => {
      const sig1 = signPayload('data', 'secret1');
      const sig2 = signPayload('data', 'secret2');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('dispatch', () => {
    it('dispatches to matching subscriptions', async () => {
      createSubscription(db, { name: 'All', url: 'https://example.com/hook' });

      // Mock fetch
      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        text: () => Promise.resolve('ok'),
      });

      const results = await dispatch(db, 'test.event', { msg: 'hello' });
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
      expect(results[0].statusCode).toBe(200);

      globalThis.fetch = origFetch;
    });

    it('skips inactive subscriptions', async () => {
      const sub = createSubscription(db, { name: 'Off', url: 'https://example.com/hook' });
      db.prepare('UPDATE webhook_subscriptions SET active = 0 WHERE id = ?').run(sub.id);

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn();

      const results = await dispatch(db, 'test.event');
      expect(results.length).toBe(0);
      expect(globalThis.fetch).not.toHaveBeenCalled();

      globalThis.fetch = origFetch;
    });

    it('handles fetch errors', async () => {
      createSubscription(db, { name: 'Broken', url: 'https://example.com/hook' });

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const results = await dispatch(db, 'test.event');
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Connection refused');

      globalThis.fetch = origFetch;
    });

    it('filters by event type', async () => {
      createSubscription(db, { name: 'Filtered', url: 'https://example.com/hook', events: ['backup.done'] });

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn();

      const results = await dispatch(db, 'agent.complete');
      expect(results.length).toBe(0);

      globalThis.fetch = origFetch;
    });

    it('logs deliveries', async () => {
      const sub = createSubscription(db, { name: 'Logged', url: 'https://example.com/hook' });

      const origFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({ status: 200, text: () => Promise.resolve('ok') });

      await dispatch(db, 'test.event');
      const deliveries = getDeliveries(db, sub.id);
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].event).toBe('test.event');

      globalThis.fetch = origFetch;
    });
  });

  describe('getDeliveries', () => {
    it('returns deliveries for a subscription', () => {
      db.prepare("INSERT INTO webhook_deliveries (id, subscription_id, event, payload, status_code, success) VALUES ('d1', 'sub1', 'test', '{}', 200, 1)").run();
      const deliveries = getDeliveries(db, 'sub1');
      expect(deliveries.length).toBe(1);
    });
  });

  describe('getRecentDeliveries', () => {
    it('returns recent deliveries across all subscriptions', () => {
      db.prepare("INSERT INTO webhook_subscriptions (id, name, url) VALUES ('s1', 'A', 'https://a.com')").run();
      db.prepare("INSERT INTO webhook_deliveries (id, subscription_id, event, payload, status_code, success) VALUES ('d1', 's1', 'test', '{}', 200, 1)").run();
      const deliveries = getRecentDeliveries(db);
      expect(deliveries.length).toBe(1);
      expect(deliveries[0].subscription_name).toBe('A');
    });
  });
});
