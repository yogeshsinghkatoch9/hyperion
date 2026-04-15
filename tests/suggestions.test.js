import { describe, it, expect } from 'vitest';

const { getSuggestions } = require('../services/suggestions');

// Helper: build a mock DB with configurable rows
function mockDB(rows) {
  return {
    prepare: () => ({
      all: () => rows,
    }),
  };
}

// Helper: create a row with a command and timestamp
function row(command, isoDate) {
  return { command, created_at: isoDate };
}

// ── Basic behavior ──
describe('getSuggestions — basics', () => {
  it('returns empty array when fewer than 6 rows', () => {
    const db = mockDB([
      row('open chrome', '2025-01-01T00:01:00'),
      row('open slack', '2025-01-01T00:02:00'),
    ]);
    expect(getSuggestions(db)).toEqual([]);
  });

  it('returns empty array on DB error', () => {
    const db = { prepare: () => { throw new Error('DB fail'); } };
    expect(getSuggestions(db)).toEqual([]);
  });

  it('returns empty array when no repeated pairs exist', () => {
    const base = '2025-01-01T00:';
    const rows = [];
    for (let i = 0; i < 8; i++) {
      rows.push(row(`unique-cmd-${i}`, `${base}${String(i).padStart(2,'0')}:00`));
    }
    // Rows are DESC order (newest first)
    rows.reverse();
    expect(getSuggestions(mockDB(rows))).toEqual([]);
  });
});

// ── Pair detection ──
describe('getSuggestions — pair detection', () => {
  it('detects a pair repeated 3+ times within 2 minutes', () => {
    // Build 6 rows: pair (A, B) repeated 3 times, all within 1 minute of each other
    // Rows in DESC order (newest first)
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const cmd = i % 2 === 0 ? 'open chrome' : 'open slack';
      rows.push(row(cmd, `2025-01-01T00:${String(i).padStart(2,'0')}:00`));
    }
    const result = getSuggestions(mockDB(rows));
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0].type).toBe('workflow_suggestion');
    expect(result[0].frequency).toBeGreaterThanOrEqual(3);
    expect(result[0].commands.length).toBe(2);
  });

  it('ignores pairs more than 2 minutes apart', () => {
    // 6 rows, each 5 minutes apart — no pair should be found
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const cmd = i % 2 === 0 ? 'open chrome' : 'open slack';
      const mins = i * 5;
      rows.push(row(cmd, `2025-01-01T00:${String(mins).padStart(2,'0')}:00`));
    }
    expect(getSuggestions(mockDB(rows))).toEqual([]);
  });

  it('ignores identical consecutive commands (cmd1 === cmd2)', () => {
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      rows.push(row('same-cmd', `2025-01-01T00:${String(i).padStart(2,'0')}:00`));
    }
    expect(getSuggestions(mockDB(rows))).toEqual([]);
  });
});

// ── Sorting and limiting ──
describe('getSuggestions — output shape', () => {
  it('sorts by frequency descending', () => {
    // Pair (A, B) appears 5 times, pair (C, D) appears 3 times
    const rows = [];
    // 5x (A, B) pairs at 1-sec intervals
    for (let i = 0; i < 10; i++) {
      const cmd = i % 2 === 0 ? 'cmd-A' : 'cmd-B';
      rows.push(row(cmd, `2025-01-01T00:00:${String(i).padStart(2,'0')}`));
    }
    // 3x (C, D) pairs
    for (let i = 10; i < 16; i++) {
      const cmd = i % 2 === 0 ? 'cmd-C' : 'cmd-D';
      rows.push(row(cmd, `2025-01-01T00:00:${String(i).padStart(2,'0')}`));
    }
    rows.reverse(); // DESC order
    const result = getSuggestions(mockDB(rows));
    if (result.length >= 2) {
      expect(result[0].frequency).toBeGreaterThanOrEqual(result[1].frequency);
    }
  });

  it('returns at most 5 suggestions', () => {
    // Create many different pairs, each repeated 3+ times
    const rows = [];
    let sec = 0;
    for (let pairIdx = 0; pairIdx < 8; pairIdx++) {
      for (let rep = 0; rep < 3; rep++) {
        rows.push(row(`pairA-${pairIdx}`, `2025-01-01T00:00:${String(sec++).padStart(2,'0')}`));
        rows.push(row(`pairB-${pairIdx}`, `2025-01-01T00:00:${String(sec++).padStart(2,'0')}`));
      }
    }
    rows.reverse();
    const result = getSuggestions(mockDB(rows));
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('each suggestion has type, message, commands, frequency', () => {
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      const cmd = i % 2 === 0 ? 'alpha' : 'beta';
      rows.push(row(cmd, `2025-01-01T00:${String(i).padStart(2,'0')}:00`));
    }
    const result = getSuggestions(mockDB(rows));
    for (const s of result) {
      expect(s).toHaveProperty('type');
      expect(s).toHaveProperty('message');
      expect(s).toHaveProperty('commands');
      expect(s).toHaveProperty('frequency');
    }
  });
});

// ── Null/empty commands ──
describe('getSuggestions — edge cases', () => {
  it('skips rows with null commands', () => {
    const rows = [];
    for (let i = 5; i >= 0; i--) {
      rows.push(row(null, `2025-01-01T00:${String(i).padStart(2,'0')}:00`));
    }
    expect(getSuggestions(mockDB(rows))).toEqual([]);
  });
});

// ── Module exports ──
describe('Module exports', () => {
  it('exports getSuggestions function', () => {
    expect(typeof getSuggestions).toBe('function');
  });
});
