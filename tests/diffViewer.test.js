import { describe, it, expect } from 'vitest';
const diff = require('../services/diffViewer');

describe('Identical Texts', () => {
  it('returns all equal entries', () => {
    const r = diff.computeDiff('a\nb\nc', 'a\nb\nc');
    expect(r.every(e => e.type === 'equal')).toBe(true);
  });
  it('has correct line count', () => {
    const r = diff.computeDiff('x\ny', 'x\ny');
    expect(r).toHaveLength(2);
  });
});

describe('Additions', () => {
  it('detects added lines', () => {
    const r = diff.computeDiff('a', 'a\nb');
    const adds = r.filter(e => e.type === 'add');
    expect(adds).toHaveLength(1);
    expect(adds[0].line).toBe('b');
  });
  it('detects multiple additions', () => {
    const r = diff.computeDiff('a', 'a\nb\nc');
    expect(r.filter(e => e.type === 'add')).toHaveLength(2);
  });
  it('handles add at beginning', () => {
    const r = diff.computeDiff('b', 'a\nb');
    const adds = r.filter(e => e.type === 'add');
    expect(adds).toHaveLength(1);
    expect(adds[0].line).toBe('a');
  });
});

describe('Deletions', () => {
  it('detects removed lines', () => {
    const r = diff.computeDiff('a\nb', 'a');
    const removes = r.filter(e => e.type === 'remove');
    expect(removes).toHaveLength(1);
    expect(removes[0].line).toBe('b');
  });
  it('detects multiple deletions', () => {
    const r = diff.computeDiff('a\nb\nc', 'a');
    expect(r.filter(e => e.type === 'remove')).toHaveLength(2);
  });
  it('handles removal at beginning', () => {
    const r = diff.computeDiff('a\nb', 'b');
    expect(r.filter(e => e.type === 'remove')).toHaveLength(1);
  });
});

describe('Mixed Changes', () => {
  it('detects mixed add and remove', () => {
    const r = diff.computeDiff('a\nb\nc', 'a\nx\nc');
    const adds = r.filter(e => e.type === 'add');
    const removes = r.filter(e => e.type === 'remove');
    expect(adds.length).toBeGreaterThanOrEqual(1);
    expect(removes.length).toBeGreaterThanOrEqual(1);
  });
  it('preserves equal lines', () => {
    const r = diff.computeDiff('a\nb\nc', 'a\nx\nc');
    const equals = r.filter(e => e.type === 'equal');
    expect(equals.length).toBeGreaterThanOrEqual(2);
  });
  it('handles complete replacement', () => {
    const r = diff.computeDiff('a\nb', 'x\ny');
    expect(r.filter(e => e.type === 'add').length).toBeGreaterThanOrEqual(2);
    expect(r.filter(e => e.type === 'remove').length).toBeGreaterThanOrEqual(2);
  });
});

describe('Character Diff', () => {
  it('detects character-level changes', () => {
    const r = diff.computeCharDiff('hello', 'hallo');
    expect(r.some(e => e.type === 'add')).toBe(true);
    expect(r.some(e => e.type === 'remove')).toBe(true);
  });
  it('returns all equal for identical lines', () => {
    const r = diff.computeCharDiff('same', 'same');
    expect(r.every(e => e.type === 'equal')).toBe(true);
  });
  it('handles empty strings', () => {
    const r = diff.computeCharDiff('', 'abc');
    expect(r.filter(e => e.type === 'add')).toHaveLength(3);
  });
});

describe('Unified Format', () => {
  it('produces unified diff string', () => {
    const d = diff.computeDiff('a\nb', 'a\nc');
    const u = diff.formatUnified(d);
    expect(u).toContain('--- a');
    expect(u).toContain('+++ b');
  });
  it('uses correct prefixes', () => {
    const d = diff.computeDiff('a', 'a\nb');
    const u = diff.formatUnified(d);
    expect(u).toContain('+b');
    expect(u).toContain(' a');
  });
});

describe('Stats', () => {
  it('counts additions', () => {
    const d = diff.computeDiff('a', 'a\nb\nc');
    const s = diff.getStats(d);
    expect(s.additions).toBe(2);
  });
  it('counts deletions', () => {
    const d = diff.computeDiff('a\nb\nc', 'a');
    const s = diff.getStats(d);
    expect(s.deletions).toBe(2);
  });
  it('counts unchanged', () => {
    const d = diff.computeDiff('a\nb', 'a\nb');
    const s = diff.getStats(d);
    expect(s.unchanged).toBe(2);
    expect(s.additions).toBe(0);
    expect(s.deletions).toBe(0);
  });
});

describe('Empty Inputs', () => {
  it('handles both empty', () => {
    const r = diff.computeDiff('', '');
    expect(r).toHaveLength(1); // single empty line
  });
  it('handles empty textA', () => {
    const r = diff.computeDiff('', 'hello');
    expect(r.filter(e => e.type === 'add').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof diff.computeDiff).toBe('function');
    expect(typeof diff.computeCharDiff).toBe('function');
    expect(typeof diff.formatUnified).toBe('function');
    expect(typeof diff.getStats).toBe('function');
    expect(typeof diff.applyPatch).toBe('function');
    expect(typeof diff.saveSnapshot).toBe('function');
    expect(typeof diff.getSnapshots).toBe('function');
    expect(typeof diff.deleteSnapshot).toBe('function');
  });
});
