/**
 * Route tests for routes/dashboard.js
 * Tests the /api/dashboard/* HTTP endpoints via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('GET /api/dashboard/activity', () => {
  it('returns an items array', async () => {
    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty('items');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('items array is not null or undefined', async () => {
    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    expect(data.items).not.toBeNull();
    expect(data.items).toBeDefined();
  });

  it('returns at most 10 items', async () => {
    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    expect(data.items.length).toBeLessThanOrEqual(10);
  });

  it('items have type, title, and timestamp fields when present', async () => {
    // Seed a notification so there is at least one activity item
    await authedFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'DashboardTest', message: 'Activity feed test', level: 'info' }),
    });

    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    // If items exist, check their shape
    if (data.items.length > 0) {
      const item = data.items[0];
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('timestamp');
    }
  });

  it('activity items are sorted by timestamp descending', async () => {
    const res = await authedFetch('/api/dashboard/activity');
    const data = await res.json();
    if (data.items.length >= 2) {
      const t0 = new Date(data.items[0].timestamp || 0).getTime();
      const t1 = new Date(data.items[1].timestamp || 0).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    }
  });
});

describe('GET /api/dashboard/stats', () => {
  it('returns a stats object', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data).toBe('object');
  });

  it('has snippets count', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(data).toHaveProperty('snippets');
    expect(typeof data.snippets).toBe('number');
  });

  it('has notebooks count', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(data).toHaveProperty('notebooks');
    expect(typeof data.notebooks).toBe('number');
  });

  it('has notes count', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(data).toHaveProperty('notes');
    expect(typeof data.notes).toBe('number');
  });

  it('has agents object with total and running', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(data).toHaveProperty('agents');
    expect(data.agents).toHaveProperty('total');
    expect(data.agents).toHaveProperty('running');
    expect(typeof data.agents.total).toBe('number');
    expect(typeof data.agents.running).toBe('number');
  });

  it('counts start at zero in a fresh database', async () => {
    const res = await authedFetch('/api/dashboard/stats');
    const data = await res.json();
    expect(data.snippets).toBe(0);
    expect(data.notebooks).toBe(0);
    expect(data.agents.total).toBe(0);
  });
});

describe('Auth gate for dashboard routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/dashboard/stats`);
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated activity requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/dashboard/activity`);
    expect(res.status).toBe(401);
  });
});
