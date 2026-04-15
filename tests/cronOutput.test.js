import { describe, it, expect } from 'vitest';

const { parseCron, matchesCron, getNextRun, validateCron, PRESETS } = await import('../services/cronScheduler.js');

describe('Cron Scheduler — Enhanced Output Capture', () => {
  describe('parseCron', () => {
    it('parses standard 5-field expression', () => {
      const cron = parseCron('*/5 * * * *');
      expect(cron).not.toBeNull();
      expect(cron.minutes.has(0)).toBe(true);
      expect(cron.minutes.has(5)).toBe(true);
      expect(cron.minutes.has(10)).toBe(true);
    });

    it('resolves @daily preset', () => {
      const cron = parseCron('@daily');
      expect(cron).not.toBeNull();
      expect(cron.minutes.has(0)).toBe(true);
      expect(cron.hours.has(0)).toBe(true);
    });

    it('resolves @hourly preset', () => {
      const cron = parseCron('@hourly');
      expect(cron.minutes.has(0)).toBe(true);
      expect(cron.hours.size).toBe(24);
    });

    it('handles range fields', () => {
      const cron = parseCron('0 9-17 * * *');
      expect(cron.hours.has(9)).toBe(true);
      expect(cron.hours.has(17)).toBe(true);
      expect(cron.hours.has(8)).toBe(false);
    });

    it('handles comma-separated values', () => {
      const cron = parseCron('0,15,30,45 * * * *');
      expect(cron.minutes.size).toBe(4);
    });

    it('handles range with step', () => {
      const cron = parseCron('0 0-23/2 * * *');
      expect(cron.hours.has(0)).toBe(true);
      expect(cron.hours.has(2)).toBe(true);
      expect(cron.hours.has(1)).toBe(false);
    });

    it('returns null for invalid expression', () => {
      expect(parseCron('invalid')).toBeNull();
      expect(parseCron('* *')).toBeNull();
    });
  });

  describe('matchesCron', () => {
    it('matches a cron at the right time', () => {
      const cron = parseCron('30 14 * * *');
      const date = new Date('2025-06-15T14:30:00');
      expect(matchesCron(cron, date)).toBe(true);
    });

    it('does not match at wrong time', () => {
      const cron = parseCron('30 14 * * *');
      const date = new Date('2025-06-15T15:30:00');
      expect(matchesCron(cron, date)).toBe(false);
    });

    it('matches day of week', () => {
      const cron = parseCron('0 0 * * 0'); // Sunday
      const sunday = new Date('2025-06-15T00:00:00'); // June 15, 2025 is Sunday
      expect(matchesCron(cron, sunday)).toBe(true);
    });
  });

  describe('getNextRun', () => {
    it('returns a future date', () => {
      const next = getNextRun('* * * * *');
      expect(next).toBeInstanceOf(Date);
      expect(next.getTime()).toBeGreaterThan(Date.now());
    });

    it('returns null for invalid cron', () => {
      expect(getNextRun('invalid')).toBeNull();
    });
  });

  describe('validateCron', () => {
    it('validates a correct expression', () => {
      const result = validateCron('0 * * * *');
      expect(result.valid).toBe(true);
      expect(result.nextRun).toBeDefined();
    });

    it('validates preset expressions', () => {
      const result = validateCron('@daily');
      expect(result.valid).toBe(true);
      expect(result.resolved).toBe('0 0 * * *');
    });

    it('invalidates bad expressions', () => {
      const result = validateCron('bad');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('PRESETS', () => {
    it('has 8 presets', () => {
      expect(Object.keys(PRESETS).length).toBe(8);
    });

    it('includes @every5m', () => {
      expect(PRESETS['@every5m']).toBe('*/5 * * * *');
    });

    it('includes @monthly', () => {
      expect(PRESETS['@monthly']).toBe('0 0 1 * *');
    });
  });
});
