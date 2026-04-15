import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';

// Mock metricsService — use default export format for CJS compat
vi.mock('../services/metricsService', () => ({
  default: {
    getMetrics: vi.fn(() => ({
      requests: { total: 1000, avgDuration: 45.2, p95Duration: 120.5, p99Duration: 250.3, byMethod: { GET: 800, POST: 200 }, byStatus: { 200: 900, 404: 50, 500: 50 } },
      system: { memUsage: 1073741824, cpuUsage: 35.5, uptime: 3600 },
    })),
  },
  getMetrics: vi.fn(() => ({
    requests: { total: 1000, avgDuration: 45.2, p95Duration: 120.5, p99Duration: 250.3, byMethod: { GET: 800, POST: 200 }, byStatus: { 200: 900, 404: 50, 500: 50 } },
    system: { memUsage: 1073741824, cpuUsage: 35.5, uptime: 3600 },
  })),
}));

const { start, stop, takeSnapshot, getHistory, getStats, MAX_SNAPSHOTS, SNAPSHOT_INTERVAL } = await import('../services/metricsHistory.js');

describe('Metrics History', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total_requests INTEGER, avg_duration REAL,
        p95_duration REAL, p99_duration REAL,
        mem_usage INTEGER, cpu_usage REAL,
        by_method TEXT DEFAULT '{}', by_status TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterEach(() => {
    stop();
  });

  describe('constants', () => {
    it('has SNAPSHOT_INTERVAL of 5 minutes', () => {
      expect(SNAPSHOT_INTERVAL).toBe(5 * 60 * 1000);
    });

    it('has MAX_SNAPSHOTS of 8640', () => {
      expect(MAX_SNAPSHOTS).toBe(8640);
    });
  });

  describe('start/stop', () => {
    it('starts and stops without error', () => {
      expect(() => start(db)).not.toThrow();
      expect(() => stop()).not.toThrow();
    });

    it('can restart', () => {
      start(db);
      stop();
      expect(() => start(db)).not.toThrow();
      stop();
    });
  });

  describe('takeSnapshot', () => {
    it('inserts a metrics snapshot', () => {
      start(db);
      takeSnapshot();
      const count = db.prepare('SELECT COUNT(*) as c FROM metrics_snapshots').get().c;
      expect(count).toBeGreaterThanOrEqual(1);
    });

    it('does nothing if db not started', () => {
      stop();
      expect(() => takeSnapshot()).not.toThrow();
    });
  });

  describe('getHistory', () => {
    it('returns snapshots within time range', () => {
      // Insert test data directly
      db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(1000, 45.2, 120.5, 250.3, 1073741824, 35.5, '{"GET":800}', '{"200":900}');
      db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(1050, 42.1, 115.0, 240.0, 1073741824, 36.0, '{"GET":850}', '{"200":950}');
      const history = getHistory(db, 24);
      expect(history.length).toBe(2);
    });

    it('parses JSON fields', () => {
      db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(1000, 45.2, 120.5, 250.3, 1073741824, 35.5, '{"GET":800,"POST":200}', '{"200":900,"404":50,"500":50}');
      const history = getHistory(db, 24);
      expect(history[0].by_method).toEqual({ GET: 800, POST: 200 });
      expect(history[0].by_status).toEqual({ 200: 900, 404: 50, 500: 50 });
    });

    it('returns empty for old data', () => {
      db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-48 hours'))")
        .run(1000, 45.2, 120.5, 250.3, 1073741824, 35.5, '{}', '{}');
      const history = getHistory(db, 1);
      expect(history.length).toBe(0);
    });

    it('handles empty by_method/by_status', () => {
      db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage) VALUES (?, ?, ?, ?, ?, ?)")
        .run(500, 30.0, 80.0, 150.0, 536870912, 20.0);
      const history = getHistory(db, 24);
      expect(history[0].by_method).toEqual({});
      expect(history[0].by_status).toEqual({});
    });
  });

  describe('getStats', () => {
    it('returns snapshot stats', () => {
      db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(1000, 45.2, 120.5, 250.3, 1073741824, 35.5, '{}', '{}');
      const stats = getStats(db);
      expect(stats.count).toBe(1);
      expect(stats.oldest).toBeDefined();
      expect(stats.newest).toBeDefined();
    });

    it('returns zeros when empty', () => {
      const stats = getStats(db);
      expect(stats.count).toBe(0);
    });

    it('tracks multiple snapshots', () => {
      for (let i = 0; i < 5; i++) {
        db.prepare("INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage, by_method, by_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(i * 100, 10 + i, 50 + i, 100 + i, 500000000, 10 + i, '{}', '{}');
      }
      const stats = getStats(db);
      expect(stats.count).toBe(5);
    });
  });
});
