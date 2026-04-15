import { describe, it, expect } from 'vitest';

const pom = require('../services/pomodoro');

// ── Duration Validation ──
describe('Duration Validation', () => {
  it('accepts valid duration', () => {
    expect(pom.validateDuration(25)).toBe(true);
  });

  it('rejects 0 minutes', () => {
    expect(pom.validateDuration(0)).toBe(false);
  });

  it('rejects > 120 minutes', () => {
    expect(pom.validateDuration(121)).toBe(false);
  });
});

// ── Timer Format ──
describe('Timer Format', () => {
  it('formats 25 minutes', () => {
    expect(pom.formatTimer(1500)).toBe('25:00');
  });

  it('formats 5 seconds', () => {
    expect(pom.formatTimer(5)).toBe('00:05');
  });

  it('formats 1 hour', () => {
    expect(pom.formatTimer(3600)).toBe('60:00');
  });

  it('handles 0 seconds', () => {
    expect(pom.formatTimer(0)).toBe('00:00');
  });
});

// ── Session Types ──
describe('Session Types', () => {
  it('has focus type', () => {
    expect(pom.VALID_TYPES).toContain('focus');
  });

  it('has break type', () => {
    expect(pom.VALID_TYPES).toContain('break');
  });

  it('has long_break type', () => {
    expect(pom.VALID_TYPES).toContain('long_break');
  });
});

// ── Defaults ──
describe('Defaults', () => {
  it('focus default is 25', () => {
    expect(pom.DEFAULTS.focus).toBe(25);
  });

  it('break default is 5', () => {
    expect(pom.DEFAULTS.break).toBe(5);
  });
});

// ── Start Guards ──
describe('Start Guards', () => {
  it('validates 1 minute', () => {
    expect(pom.validateDuration(1)).toBe(true);
  });

  it('validates 120 minutes', () => {
    expect(pom.validateDuration(120)).toBe(true);
  });

  it('rejects NaN', () => {
    expect(pom.validateDuration('abc')).toBe(false);
  });
});

// ── Day Stats Logic ──
describe('Day Stats Logic', () => {
  it('getDefaults returns all types', () => {
    const d = pom.getDefaults();
    expect(d.types).toEqual(['focus', 'break', 'long_break']);
  });

  it('getDefaults returns focus duration', () => {
    const d = pom.getDefaults();
    expect(d.focus).toBe(25);
  });

  it('getDefaults returns long_break duration', () => {
    const d = pom.getDefaults();
    expect(d.long_break).toBe(15);
  });
});

// ── Streak Logic ──
describe('Streak Logic', () => {
  it('formatTimer handles negative gracefully', () => {
    expect(pom.formatTimer(-5)).toBe('00:00');
  });

  it('formatTimer handles large values', () => {
    expect(pom.formatTimer(7200)).toBe('120:00');
  });

  it('formatTimer handles 59 seconds', () => {
    expect(pom.formatTimer(59)).toBe('00:59');
  });
});

// ── Exports ──
describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof pom.validateDuration).toBe('function');
    expect(typeof pom.formatTimer).toBe('function');
    expect(typeof pom.startSession).toBe('function');
    expect(typeof pom.completeSession).toBe('function');
    expect(typeof pom.cancelSession).toBe('function');
    expect(typeof pom.getActiveSession).toBe('function');
    expect(typeof pom.getSessions).toBe('function');
    expect(typeof pom.getDayStats).toBe('function');
    expect(typeof pom.getWeekStats).toBe('function');
    expect(typeof pom.getStreak).toBe('function');
    expect(typeof pom.getDefaults).toBe('function');
  });
});
