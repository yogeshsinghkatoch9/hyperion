import { describe, test, expect, beforeEach, afterEach } from 'vitest';
const Database = require('better-sqlite3');
const analytics = require('../services/analyticsService');

let db;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  require('../services/db')(db);
});

afterEach(() => {
  db.close();
});

describe('track', () => {
  test('inserts an event and returns an id', () => {
    const id = analytics.track(db, { event: 'page_view', page: '/dashboard' });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    const row = db.prepare('SELECT * FROM analytics_events WHERE id = ?').get(id);
    expect(row.event).toBe('page_view');
    expect(row.page).toBe('/dashboard');
  });

  test('stores metadata as JSON string', () => {
    const id = analytics.track(db, { event: 'click', metadata: { button: 'submit' } });
    const row = db.prepare('SELECT metadata FROM analytics_events WHERE id = ?').get(id);
    expect(JSON.parse(row.metadata)).toEqual({ button: 'submit' });
  });

  test('stores userId when provided', () => {
    const id = analytics.track(db, { event: 'login', userId: 'user-1' });
    const row = db.prepare('SELECT user_id FROM analytics_events WHERE id = ?').get(id);
    expect(row.user_id).toBe('user-1');
  });

  test('handles null page and userId gracefully', () => {
    const id = analytics.track(db, { event: 'boot' });
    const row = db.prepare('SELECT * FROM analytics_events WHERE id = ?').get(id);
    expect(row.page).toBeNull();
    expect(row.user_id).toBeNull();
  });
});

describe('getPageViews', () => {
  test('groups by page and sorts by views descending', () => {
    analytics.track(db, { event: 'page_view', page: '/home' });
    analytics.track(db, { event: 'page_view', page: '/home' });
    analytics.track(db, { event: 'page_view', page: '/about' });
    const result = analytics.getPageViews(db);
    const views = result.rows;
    expect(views[0].page).toBe('/home');
    expect(views[0].views).toBe(2);
    expect(views[1].page).toBe('/about');
    expect(views[1].views).toBe(1);
    expect(result.total).toBe(2);
  });

  test('respects limit parameter', () => {
    for (let i = 0; i < 5; i++) {
      analytics.track(db, { event: 'page_view', page: `/page-${i}` });
    }
    const result = analytics.getPageViews(db, { limit: 3 });
    expect(result.rows).toHaveLength(3);
    expect(result.total).toBe(5);
  });
});

describe('getTopFeatures', () => {
  test('returns events sorted by count descending', () => {
    analytics.track(db, { event: 'terminal_open' });
    analytics.track(db, { event: 'terminal_open' });
    analytics.track(db, { event: 'terminal_open' });
    analytics.track(db, { event: 'file_edit' });
    const result = analytics.getTopFeatures(db);
    const features = result.rows;
    expect(features[0].event).toBe('terminal_open');
    expect(features[0].count).toBe(3);
    expect(features[1].event).toBe('file_edit');
    expect(features[1].count).toBe(1);
    expect(result.total).toBe(2);
  });
});

describe('getActivityTimeline', () => {
  test('buckets events by time period', () => {
    // Insert events with explicit timestamps
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO analytics_events (id, event, created_at) VALUES (?, ?, ?)'
    ).run('t1', 'ev1', now);
    db.prepare(
      'INSERT INTO analytics_events (id, event, created_at) VALUES (?, ?, ?)'
    ).run('t2', 'ev2', now);
    const timeline = analytics.getActivityTimeline(db, { bucketMinutes: 60 });
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    expect(timeline[0].count).toBeGreaterThanOrEqual(2);
    expect(timeline[0]).toHaveProperty('timestamp');
  });

  test('returns empty array when no events exist', () => {
    const timeline = analytics.getActivityTimeline(db);
    expect(timeline).toEqual([]);
  });
});

describe('getStats', () => {
  test('returns total events and unique users', () => {
    analytics.track(db, { event: 'a', userId: 'u1' });
    analytics.track(db, { event: 'b', userId: 'u1' });
    analytics.track(db, { event: 'c', userId: 'u2' });
    const stats = analytics.getStats(db);
    expect(stats.total).toBe(3);
    expect(stats.uniqueUsers).toBe(2);
  });

  test('returns top pages and top events', () => {
    analytics.track(db, { event: 'page_view', page: '/dash' });
    analytics.track(db, { event: 'page_view', page: '/dash' });
    analytics.track(db, { event: 'click', page: '/settings' });
    const stats = analytics.getStats(db);
    expect(stats.topPages[0].page).toBe('/dash');
    expect(stats.topPages[0].views).toBe(2);
    expect(stats.topEvents[0].event).toBe('page_view');
    expect(stats.topEvents[0].count).toBe(2);
  });

  test('handles empty database', () => {
    const stats = analytics.getStats(db);
    expect(stats.total).toBe(0);
    expect(stats.uniqueUsers).toBe(0);
    expect(stats.topPages).toEqual([]);
    expect(stats.topEvents).toEqual([]);
  });
});
