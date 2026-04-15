import { describe, it, expect } from 'vitest';

const cron = require('../services/cron');

// ── Parse Expression ──
describe('Parse Cron Expression', () => {
  it('parses 5-field expression', () => {
    const f = cron.parseCronExpression('*/5 * * * * echo hello');
    expect(f.minute).toBe('*/5');
    expect(f.hour).toBe('*');
    expect(f.dayOfMonth).toBe('*');
    expect(f.month).toBe('*');
    expect(f.dayOfWeek).toBe('*');
    expect(f.command).toBe('echo hello');
  });
  it('throws on too few fields', () => {
    expect(() => cron.parseCronExpression('* * *')).toThrow('5 fields');
  });
  it('throws on empty input', () => {
    expect(() => cron.parseCronExpression('')).toThrow();
  });
});

// ── Describe Expression ──
describe('Describe Cron Expression', () => {
  it('describes every minute', () => {
    expect(cron.describeCronExpression('* * * * * cmd')).toContain('Every minute');
  });
  it('describes every hour', () => {
    expect(cron.describeCronExpression('0 * * * * cmd')).toContain('Every hour');
  });
  it('describes specific time', () => {
    const desc = cron.describeCronExpression('30 14 * * * cmd');
    expect(desc).toContain('14:30');
  });
  it('describes every 5 minutes', () => {
    expect(cron.describeCronExpression('*/5 * * * * cmd')).toContain('5 minutes');
  });
  it('handles invalid input', () => {
    expect(cron.describeCronExpression('bad')).toBe('Invalid expression');
  });
  it('includes day of week', () => {
    const desc = cron.describeCronExpression('0 9 * * 1 cmd');
    expect(desc).toContain('Mon');
  });
  it('includes month', () => {
    const desc = cron.describeCronExpression('0 0 1 6 * cmd');
    expect(desc).toContain('Jun');
  });
});

// ── Validate Expression ──
describe('Validate Cron Expression', () => {
  it('validates correct expression', () => {
    expect(cron.validateCronExpression('0 0 * * * cmd')).toEqual({ valid: true });
  });
  it('validates step expression', () => {
    expect(cron.validateCronExpression('*/5 * * * * cmd')).toEqual({ valid: true });
  });
  it('rejects invalid minute', () => {
    const r = cron.validateCronExpression('60 * * * * cmd');
    expect(r.valid).toBe(false);
  });
  it('rejects invalid hour', () => {
    const r = cron.validateCronExpression('0 25 * * * cmd');
    expect(r.valid).toBe(false);
  });
  it('validates ranges', () => {
    expect(cron.validateCronExpression('0 9 * * 1-5 cmd')).toEqual({ valid: true });
  });
  it('validates comma lists', () => {
    expect(cron.validateCronExpression('0 9,12,18 * * * cmd')).toEqual({ valid: true });
  });
});

// ── Match Field ──
describe('Match Field', () => {
  it('* matches everything', () => {
    expect(cron.matchesField('*', 0)).toBe(true);
    expect(cron.matchesField('*', 59)).toBe(true);
  });
  it('step matches correctly', () => {
    expect(cron.matchesField('*/5', 0)).toBe(true);
    expect(cron.matchesField('*/5', 5)).toBe(true);
    expect(cron.matchesField('*/5', 3)).toBe(false);
  });
  it('exact match', () => {
    expect(cron.matchesField('30', 30)).toBe(true);
    expect(cron.matchesField('30', 29)).toBe(false);
  });
  it('range match', () => {
    expect(cron.matchesField('1-5', 3)).toBe(true);
    expect(cron.matchesField('1-5', 6)).toBe(false);
  });
  it('comma list match', () => {
    expect(cron.matchesField('1,3,5', 3)).toBe(true);
    expect(cron.matchesField('1,3,5', 2)).toBe(false);
  });
});

// ── Next Runs ──
describe('Next Runs', () => {
  it('returns requested count', () => {
    const runs = cron.getNextRuns('* * * * * cmd', 3);
    expect(runs).toHaveLength(3);
  });
  it('returns valid ISO dates', () => {
    const runs = cron.getNextRuns('0 * * * * cmd', 2);
    runs.forEach(r => expect(new Date(r).toISOString()).toBe(r));
  });
  it('runs are in chronological order', () => {
    const runs = cron.getNextRuns('*/10 * * * * cmd', 3);
    for (let i = 1; i < runs.length; i++) {
      expect(new Date(runs[i]).getTime()).toBeGreaterThan(new Date(runs[i-1]).getTime());
    }
  });
});

// ── Presets ──
describe('Presets', () => {
  it('returns preset list', () => {
    const presets = cron.getPresets();
    expect(presets.length).toBeGreaterThan(5);
    expect(presets[0]).toHaveProperty('name');
    expect(presets[0]).toHaveProperty('schedule');
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'parseCronExpression', 'describeCronExpression', 'validateCronExpression',
      'getNextRuns', 'matchesField',
      'listCrontab', 'addCrontabEntry', 'removeCrontabEntry', 'updateCrontabEntry',
      'getPresets', 'logCronRun', 'getCronHistory',
    ];
    for (const fn of fns) {
      expect(typeof cron[fn]).toBe('function');
    }
  });
});
