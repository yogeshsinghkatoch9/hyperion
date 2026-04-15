/**
 * Cron Scheduler Tests — expression parsing, next-run calculation
 */
import { describe, test, expect } from 'vitest';
const { parseCron, matchesCron, getNextRun, validateCron, PRESETS } = require('../services/cronScheduler');

describe('Cron Parser', () => {
  test('parseCron handles standard 5-field expression', () => {
    const cron = parseCron('30 2 * * *'); // 2:30 AM daily
    expect(cron).toBeTruthy();
    expect(cron.minutes.has(30)).toBe(true);
    expect(cron.hours.has(2)).toBe(true);
    expect(cron.daysOfMonth.size).toBe(31);
    expect(cron.months.size).toBe(12);
    expect(cron.daysOfWeek.size).toBe(7);
  });

  test('parseCron handles step values', () => {
    const cron = parseCron('*/5 * * * *'); // every 5 minutes
    expect(cron.minutes.has(0)).toBe(true);
    expect(cron.minutes.has(5)).toBe(true);
    expect(cron.minutes.has(10)).toBe(true);
    expect(cron.minutes.has(55)).toBe(true);
    expect(cron.minutes.has(3)).toBe(false);
  });

  test('parseCron handles ranges', () => {
    const cron = parseCron('0 9-17 * * *'); // 9 AM to 5 PM
    expect(cron.hours.has(9)).toBe(true);
    expect(cron.hours.has(17)).toBe(true);
    expect(cron.hours.has(8)).toBe(false);
    expect(cron.hours.has(18)).toBe(false);
  });

  test('parseCron handles comma-separated values', () => {
    const cron = parseCron('0 0 * * 1,3,5'); // Mon, Wed, Fri
    expect(cron.daysOfWeek.has(1)).toBe(true);
    expect(cron.daysOfWeek.has(3)).toBe(true);
    expect(cron.daysOfWeek.has(5)).toBe(true);
    expect(cron.daysOfWeek.has(2)).toBe(false);
  });

  test('parseCron resolves presets', () => {
    const cron = parseCron('@hourly');
    expect(cron.minutes.has(0)).toBe(true);
    expect(cron.minutes.size).toBe(1);
  });

  test('parseCron returns null for invalid expressions', () => {
    expect(parseCron('invalid')).toBeNull();
    expect(parseCron('* *')).toBeNull();
    expect(parseCron('')).toBeNull();
  });
});

describe('Cron Matching', () => {
  test('matchesCron matches correctly', () => {
    const cron = parseCron('30 14 * * *'); // 2:30 PM daily
    const date = new Date(2026, 3, 10, 14, 30, 0); // Apr 10, 2026 2:30 PM
    expect(matchesCron(cron, date)).toBe(true);
  });

  test('matchesCron rejects non-matching time', () => {
    const cron = parseCron('30 14 * * *');
    const date = new Date(2026, 3, 10, 15, 30, 0); // 3:30 PM — wrong hour
    expect(matchesCron(cron, date)).toBe(false);
  });
});

describe('Next Run', () => {
  test('getNextRun returns future date', () => {
    const next = getNextRun('0 * * * *'); // every hour
    expect(next).toBeTruthy();
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });

  test('getNextRun returns null for impossible expression', () => {
    // Invalid expression
    expect(getNextRun('bad')).toBeNull();
  });
});

describe('Validation', () => {
  test('validateCron accepts valid expressions', () => {
    const result = validateCron('*/5 * * * *');
    expect(result.valid).toBe(true);
    expect(result.nextRun).toBeTruthy();
  });

  test('validateCron accepts presets', () => {
    const result = validateCron('@hourly');
    expect(result.valid).toBe(true);
    expect(result.resolved).toBe('0 * * * *');
  });

  test('validateCron rejects invalid expressions', () => {
    const result = validateCron('not a cron');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});

describe('Presets', () => {
  test('all presets are valid cron expressions', () => {
    for (const [preset, expr] of Object.entries(PRESETS)) {
      const cron = parseCron(expr);
      expect(cron, `Preset ${preset} should parse`).toBeTruthy();
    }
  });
});
