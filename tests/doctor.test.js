/**
 * Doctor Tests — diagnostic checks
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
const Database = require('better-sqlite3');

describe('Doctor Diagnostics', () => {
  let db, doctor;

  beforeAll(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    require('../services/db')(db);
    doctor = require('../services/doctor');
  });

  afterAll(() => {
    db.close();
  });

  test('runDiagnostics returns a full report', async () => {
    const report = await doctor.runDiagnostics(db);
    expect(report).toHaveProperty('score');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('checks');
    expect(report).toHaveProperty('timestamp');
    expect(report).toHaveProperty('system');
    expect(typeof report.score).toBe('number');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(100);
  });

  test('report summary has correct structure', async () => {
    const report = await doctor.runDiagnostics(db);
    expect(report.summary).toHaveProperty('passed');
    expect(report.summary).toHaveProperty('warned');
    expect(report.summary).toHaveProperty('failed');
    expect(report.summary).toHaveProperty('total');
    expect(report.summary.total).toBe(report.checks.length);
    expect(report.summary.passed + report.summary.warned + report.summary.failed).toBe(report.summary.total);
  });

  test('each check has required fields', async () => {
    const report = await doctor.runDiagnostics(db);
    for (const check of report.checks) {
      expect(check).toHaveProperty('name');
      expect(check).toHaveProperty('value');
      expect(check).toHaveProperty('status');
      expect(check).toHaveProperty('detail');
      expect(['pass', 'warn', 'fail']).toContain(check.status);
    }
  });

  test('Node.js version check passes on current runtime', async () => {
    const report = await doctor.runDiagnostics(db);
    const nodeCheck = report.checks.find(c => c.name === 'Node.js Version');
    expect(nodeCheck).toBeTruthy();
    expect(nodeCheck.status).toBe('pass'); // We're running on Node 18+
  });

  test('SQLite integrity check passes on fresh database', async () => {
    const report = await doctor.runDiagnostics(db);
    const sqliteCheck = report.checks.find(c => c.name === 'SQLite Integrity');
    expect(sqliteCheck).toBeTruthy();
    expect(sqliteCheck.status).toBe('pass');
  });

  test('system info is populated', async () => {
    const report = await doctor.runDiagnostics(db);
    expect(report.system.hostname).toBeTruthy();
    expect(report.system.platform).toBeTruthy();
    expect(report.system.nodeVersion).toBe(process.version);
    expect(report.system.cpuCount).toBeGreaterThan(0);
  });

  test('quick mode returns fewer checks', async () => {
    const full = await doctor.runDiagnostics(db);
    const quick = await doctor.runDiagnostics(db, { quick: true });
    expect(quick.checks.length).toBeLessThan(full.checks.length);
  });
});
