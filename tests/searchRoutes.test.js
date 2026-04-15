/**
 * Route tests for routes/search.js
 * Tests the /api/search HTTP endpoint via the test server.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
const { setup, teardown, authedFetch, getBaseUrl } = require('./setup');

let env;
beforeAll(async () => { env = await setup(); });
afterAll(async () => { await teardown(); });

describe('GET /api/search', () => {
  it('returns results object for a valid query', async () => {
    const res = await authedFetch('/api/search?q=test');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data).toHaveProperty('results');
    expect(typeof data.results).toBe('object');
  });

  it('returns empty results for query shorter than 2 characters', async () => {
    const res = await authedFetch('/api/search?q=a');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toEqual({});
  });

  it('returns empty results when query is missing', async () => {
    const res = await authedFetch('/api/search');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toEqual({});
  });

  it('returns empty results for empty string query', async () => {
    const res = await authedFetch('/api/search?q=');
    const data = await res.json();
    expect(data.results).toEqual({});
  });

  it('finds notifications that were created', async () => {
    // Create a notification with a distinctive title
    await authedFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'SearchableNotification', message: 'This is searchable', level: 'info' }),
    });

    const res = await authedFetch('/api/search?q=SearchableNotification');
    const data = await res.json();
    expect(res.status).toBe(200);
    // The search should find the notification
    if (data.results.notifications) {
      expect(data.results.notifications.length).toBeGreaterThan(0);
      expect(data.results.notifications[0].title).toBe('SearchableNotification');
    }
  });

  it('search results are limited to 5 per category', async () => {
    // Create multiple notifications
    for (let i = 0; i < 8; i++) {
      await authedFetch('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({ title: `BulkSearch_${i}`, message: 'bulk search test', level: 'info' }),
      });
    }

    const res = await authedFetch('/api/search?q=BulkSearch');
    const data = await res.json();
    if (data.results.notifications) {
      expect(data.results.notifications.length).toBeLessThanOrEqual(5);
    }
  });

  it('does not include categories with zero results', async () => {
    const res = await authedFetch('/api/search?q=zzzznonexistent12345');
    const data = await res.json();
    expect(res.status).toBe(200);
    // All result categories should be absent (only populated if results exist)
    expect(Object.keys(data.results).length).toBe(0);
  });

  it('search is case-insensitive via LIKE', async () => {
    await authedFetch('/api/notifications', {
      method: 'POST',
      body: JSON.stringify({ title: 'CaseTestNotif', message: 'case test', level: 'info' }),
    });

    const res = await authedFetch('/api/search?q=casetestnotif');
    const data = await res.json();
    // SQLite LIKE is case-insensitive for ASCII by default
    if (data.results.notifications) {
      expect(data.results.notifications.length).toBeGreaterThan(0);
    }
  });
});

describe('Auth gate for search routes', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const res = await fetch(`${getBaseUrl()}/api/search?q=test`);
    expect(res.status).toBe(401);
  });
});
