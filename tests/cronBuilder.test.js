import { describe, it, expect } from 'vitest';
const cron = require('../services/cronBuilder');

describe('Parse Valid', () => {
  it('parses standard cron', () => {
    const r = cron.parseCron('*/5 * * * *');
    expect(r.minute).toBe('*/5');
    expect(r.hour).toBe('*');
  });
  it('parses specific time', () => {
    const r = cron.parseCron('30 9 * * 1');
    expect(r.minute).toBe('30');
    expect(r.hour).toBe('9');
    expect(r.dayOfWeek).toBe('1');
  });
  it('parses ranges', () => {
    const r = cron.parseCron('0 9-17 * * 1-5');
    expect(r.hour).toBe('9-17');
    expect(r.dayOfWeek).toBe('1-5');
  });
  it('parses lists', () => {
    const r = cron.parseCron('0 0 1,15 * *');
    expect(r.dayOfMonth).toBe('1,15');
  });
});

describe('Parse Invalid', () => {
  it('rejects too few fields', () => {
    expect(() => cron.parseCron('* * *')).toThrow();
  });
  it('rejects too many fields', () => {
    expect(() => cron.parseCron('* * * * * *')).toThrow();
  });
  it('rejects out-of-range values', () => {
    expect(() => cron.parseCron('60 * * * *')).toThrow();
  });
});

describe('Explain', () => {
  it('explains every minute', () => {
    const r = cron.explainCron('* * * * *');
    expect(r.toLowerCase()).toContain('every minute');
  });
  it('explains specific time', () => {
    const r = cron.explainCron('0 9 * * *');
    expect(r).toContain('9');
    expect(r).toContain('AM');
  });
  it('explains interval', () => {
    const r = cron.explainCron('*/15 * * * *');
    expect(r).toContain('15');
    expect(r.toLowerCase()).toContain('minute');
  });
  it('explains day of week', () => {
    const r = cron.explainCron('0 0 * * 1');
    expect(r).toContain('Monday');
  });
});

describe('Build Roundtrip', () => {
  it('builds from parts', () => {
    const expr = cron.buildCron({ minute: '0', hour: '12', dayOfMonth: '*', month: '*', dayOfWeek: '*' });
    expect(expr).toBe('0 12 * * *');
  });
  it('defaults to *', () => {
    const expr = cron.buildCron({});
    expect(expr).toBe('* * * * *');
  });
  it('roundtrips parse → build', () => {
    const parsed = cron.parseCron('30 9 1 6 3');
    const rebuilt = cron.buildCron(parsed);
    expect(rebuilt).toBe('30 9 1 6 3');
  });
});

describe('Next Runs', () => {
  it('returns requested count', () => {
    const runs = cron.getNextRuns('* * * * *', 5);
    expect(runs).toHaveLength(5);
  });
  it('returns ISO date strings', () => {
    const runs = cron.getNextRuns('0 * * * *', 3);
    expect(runs[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('runs are in chronological order', () => {
    const runs = cron.getNextRuns('*/10 * * * *', 5);
    for (let i = 1; i < runs.length; i++) {
      expect(new Date(runs[i]).getTime()).toBeGreaterThan(new Date(runs[i - 1]).getTime());
    }
  });
});

describe('Validate', () => {
  it('validates correct expression', () => {
    expect(cron.validateCron('0 12 * * *')).toEqual({ valid: true, error: null });
  });
  it('invalidates bad expression', () => {
    const r = cron.validateCron('bad');
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
});

describe('Presets', () => {
  it('returns presets array', () => {
    const p = cron.getPresets();
    expect(Array.isArray(p)).toBe(true);
    expect(p.length).toBeGreaterThan(5);
  });
  it('each preset has name and expression', () => {
    const p = cron.getPresets()[0];
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('expression');
    expect(p).toHaveProperty('description');
  });
});

describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof cron.parseCron).toBe('function');
    expect(typeof cron.explainCron).toBe('function');
    expect(typeof cron.buildCron).toBe('function');
    expect(typeof cron.getNextRuns).toBe('function');
    expect(typeof cron.validateCron).toBe('function');
    expect(typeof cron.getPresets).toBe('function');
    expect(typeof cron.isValidField).toBe('function');
    expect(typeof cron.savePreset).toBe('function');
    expect(typeof cron.getCustomPresets).toBe('function');
    expect(typeof cron.deletePreset).toBe('function');
  });
});
