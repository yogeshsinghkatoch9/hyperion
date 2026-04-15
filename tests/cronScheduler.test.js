/**
 * Cron Scheduler Tests — parseCron, matchesCron, getNextRun, validateCron,
 * start/stop lifecycle, getCronRuns
 */
import { describe, test, expect, vi, afterEach } from 'vitest';

const { parseCron, matchesCron, getNextRun, validateCron, PRESETS, start, stop, getCronRuns } = require('../services/cronScheduler');

afterEach(() => { stop(); });

describe('parseCron', () => {
  test('parses standard 5-field expression', () => {
    const c = parseCron('0 12 * * *');
    expect(c).toBeTruthy();
    expect(c.minutes.has(0)).toBe(true);
    expect(c.hours.has(12)).toBe(true);
    expect(c.daysOfMonth.size).toBe(31);
  });

  test('handles step, range-step, and comma values', () => {
    expect([...parseCron('*/15 * * * *').minutes]).toEqual([0, 15, 30, 45]);
    const rs = parseCron('1-10/3 * * * *');
    expect([...rs.minutes].sort((a, b) => a - b)).toEqual([1, 4, 7, 10]);
    const cm = parseCron('0 0 1,15 * *');
    expect(cm.daysOfMonth.size).toBe(2);
    expect(cm.daysOfMonth.has(1) && cm.daysOfMonth.has(15)).toBe(true);
  });

  test('resolves presets and returns null for invalid input', () => {
    const daily = parseCron('@daily');
    expect(daily.minutes.size).toBe(1);
    expect(daily.hours.size).toBe(1);
    expect(parseCron('bad')).toBeNull();
    expect(parseCron('* *')).toBeNull();
  });
});

describe('matchesCron', () => {
  test('matches when date fits all fields', () => {
    const c = parseCron('30 9 15 4 *');
    expect(matchesCron(c, new Date(2026, 3, 15, 9, 30, 0))).toBe(true);
  });

  test('rejects when minute or day-of-week differs', () => {
    expect(matchesCron(parseCron('30 9 * * *'), new Date(2026, 3, 15, 9, 31, 0))).toBe(false);
    // Apr 15 2026 is Wednesday (3), cron wants Sunday (0)
    expect(matchesCron(parseCron('0 0 * * 0'), new Date(2026, 3, 15, 0, 0, 0))).toBe(false);
  });
});

describe('getNextRun', () => {
  test('returns a future Date for valid, null for invalid', () => {
    const next = getNextRun('*/5 * * * *');
    expect(next).toBeInstanceOf(Date);
    expect(next.getTime()).toBeGreaterThan(Date.now());
    expect(getNextRun('invalid')).toBeNull();
  });
});

describe('validateCron', () => {
  test('valid expression returns valid:true with nextRun and resolved', () => {
    const r = validateCron('0 0 * * *');
    expect(r.valid).toBe(true);
    expect(r.nextRun).toBeTruthy();
    expect(r.resolved).toBe('0 0 * * *');
  });

  test('preset resolves correctly', () => {
    const r = validateCron('@weekly');
    expect(r.valid).toBe(true);
    expect(r.resolved).toBe('0 0 * * 0');
  });

  test('invalid expression returns valid:false with error', () => {
    const r = validateCron('nope');
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe('PRESETS', () => {
  test('all presets parse and include hourly/daily/weekly/monthly', () => {
    for (const [name, expr] of Object.entries(PRESETS)) {
      expect(parseCron(expr), `${name} should parse`).toBeTruthy();
    }
    expect(PRESETS).toHaveProperty('@hourly');
    expect(PRESETS).toHaveProperty('@daily');
    expect(PRESETS).toHaveProperty('@weekly');
    expect(PRESETS).toHaveProperty('@monthly');
  });
});

describe('start / stop / getCronRuns', () => {
  const mockDb = { prepare: () => ({ all: () => [], get: () => null, run: () => {} }) };

  test('start and stop do not throw with a mock db', () => {
    expect(() => start(mockDb)).not.toThrow();
    expect(() => stop()).not.toThrow();
  });

  test('getCronRuns returns empty array for non-existent agent', () => {
    start(mockDb);
    const runs = getCronRuns('nonexistent-agent');
    expect(Array.isArray(runs)).toBe(true);
    expect(runs.length).toBe(0);
  });

  test('getCronRuns uses default limit of 20', () => {
    let capturedLimit;
    const spyDb = {
      prepare: () => ({
        all: (_id, limit) => { capturedLimit = limit; return []; },
        get: () => null, run: () => {},
      }),
    };
    start(spyDb);
    getCronRuns('agent-1');
    expect(capturedLimit).toBe(20);
  });
});
