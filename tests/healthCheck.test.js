import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';

const healthCheck = require('../services/healthCheck');

function createTestDB() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total_requests INTEGER,
      avg_duration REAL,
      p95_duration REAL,
      p99_duration REAL,
      mem_usage INTEGER,
      cpu_usage REAL,
      by_method TEXT DEFAULT '{}',
      by_status TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      key TEXT NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, key)
    );
  `);
  return db;
}

describe('healthCheck', () => {
  let db;
  beforeEach(() => { db = createTestDB(); });

  describe('runChecks', () => {
    it('returns health status object', () => {
      const result = healthCheck.runChecks(db);
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('checks');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('nodeVersion');
      expect(['healthy', 'degraded']).toContain(result.status);
    });

    it('checks database connectivity', () => {
      const result = healthCheck.runChecks(db);
      expect(result.checks.database).toHaveProperty('status');
      expect(result.checks.database).toHaveProperty('latency');
      expect(result.checks.database.status).toBe('ok');
    });

    it('checks memory', () => {
      const result = healthCheck.runChecks(db);
      expect(result.checks.memory).toHaveProperty('percent');
      expect(result.checks.memory).toHaveProperty('total');
      expect(result.checks.memory.percent).toBeGreaterThan(0);
    });

    it('checks CPU', () => {
      const result = healthCheck.runChecks(db);
      expect(result.checks.cpu).toHaveProperty('loadPercent');
      expect(result.checks.cpu).toHaveProperty('cores');
      expect(result.checks.cpu.cores).toBeGreaterThan(0);
    });

    it('checks API latency from metrics', () => {
      db.prepare(
        "INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage) VALUES (100, 42.5, 120.0, 200.0, 100000, 25.0)"
      ).run();
      const result = healthCheck.runChecks(db);
      expect(result.checks.api.avgLatency).toBe(43); // rounded
    });

    it('checks services', () => {
      const result = healthCheck.runChecks(db);
      expect(result.checks.services).toHaveProperty('status');
      expect(result.checks.services).toHaveProperty('details');
    });
  });

  describe('getHealthTrend', () => {
    it('returns empty array when no data', () => {
      const trend = healthCheck.getHealthTrend(db, 24);
      expect(trend).toEqual([]);
    });

    it('returns historical snapshots', () => {
      for (let i = 0; i < 5; i++) {
        db.prepare(
          "INSERT INTO metrics_snapshots (total_requests, avg_duration, p95_duration, p99_duration, mem_usage, cpu_usage) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(100 + i, 40 + i, 100 + i, 200 + i, 50000, 20 + i);
      }
      const trend = healthCheck.getHealthTrend(db, 24);
      expect(trend).toHaveLength(5);
      expect(trend[0]).toHaveProperty('avg_duration');
    });

    it('limits hours to valid range', () => {
      const trend = healthCheck.getHealthTrend(db, 999);
      expect(Array.isArray(trend)).toBe(true);
    });
  });

  describe('evaluateAlerts', () => {
    it('returns empty when no thresholds exceeded', () => {
      const snapshot = {
        checks: {
          cpu: { loadPercent: 30 },
          memory: { percent: 50 },
          disk: { usedPercent: 40 },
          api: { avgLatency: 50 },
        },
      };
      const alerts = healthCheck.evaluateAlerts(db, snapshot);
      expect(alerts).toHaveLength(0);
    });

    it('triggers CPU warning', () => {
      const snapshot = {
        checks: {
          cpu: { loadPercent: 95 },
          memory: { percent: 50 },
          disk: { usedPercent: 40 },
          api: { avgLatency: 50 },
        },
      };
      const alerts = healthCheck.evaluateAlerts(db, snapshot);
      const cpuAlert = alerts.find(a => a.metric === 'cpu');
      expect(cpuAlert).toBeDefined();
      expect(cpuAlert.level).toBe('warning');
    });

    it('triggers memory critical', () => {
      const snapshot = {
        checks: {
          cpu: { loadPercent: 30 },
          memory: { percent: 95 },
          disk: { usedPercent: 40 },
          api: { avgLatency: 50 },
        },
      };
      const alerts = healthCheck.evaluateAlerts(db, snapshot);
      const memAlert = alerts.find(a => a.metric === 'memory_percent');
      expect(memAlert).toBeDefined();
      expect(memAlert.level).toBe('critical');
    });

    it('uses custom rules when saved', () => {
      healthCheck.saveAlertRules(db, [
        { metric: 'cpu', operator: 'gt', value: 10, level: 'warning' },
      ]);
      const snapshot = { checks: { cpu: { loadPercent: 20 } } };
      const alerts = healthCheck.evaluateAlerts(db, snapshot);
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAlertRules / saveAlertRules', () => {
    it('returns defaults when none saved', () => {
      const rules = healthCheck.getAlertRules(db);
      expect(rules).toEqual(healthCheck.DEFAULT_ALERT_RULES);
    });

    it('saves and retrieves custom rules', () => {
      const custom = [{ metric: 'cpu', operator: 'gt', value: 50, level: 'critical' }];
      healthCheck.saveAlertRules(db, custom);
      const rules = healthCheck.getAlertRules(db);
      expect(rules).toEqual(custom);
    });

    it('handles invalid input gracefully', () => {
      const result = healthCheck.saveAlertRules(db, 'not-an-array');
      expect(result).toEqual(healthCheck.DEFAULT_ALERT_RULES);
    });
  });

  describe('DEFAULT_ALERT_RULES', () => {
    it('has expected rules', () => {
      expect(healthCheck.DEFAULT_ALERT_RULES).toHaveLength(4);
      const metrics = healthCheck.DEFAULT_ALERT_RULES.map(r => r.metric);
      expect(metrics).toContain('cpu');
      expect(metrics).toContain('memory_percent');
      expect(metrics).toContain('disk_percent');
      expect(metrics).toContain('avg_latency');
    });
  });
});
