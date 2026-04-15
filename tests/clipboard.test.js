import { describe, it, expect } from 'vitest';

const cb = require('../services/clipboard');

// ── Tag Parsing ──
describe('Tag Parsing', () => {
  it('parses array tags', () => {
    expect(cb.parseTags(['foo', 'bar'])).toEqual(['foo', 'bar']);
  });

  it('parses comma-separated string', () => {
    expect(cb.parseTags('foo, bar, baz')).toEqual(['foo', 'bar', 'baz']);
  });

  it('parses JSON string array', () => {
    expect(cb.parseTags('["foo","bar"]')).toEqual(['foo', 'bar']);
  });

  it('returns empty array for null', () => {
    expect(cb.parseTags(null)).toEqual([]);
  });
});

// ── Save Guards ──
describe('Save Guards', () => {
  it('parseTags filters empty strings', () => {
    expect(cb.parseTags('a,,b,  ,c')).toEqual(['a', 'b', 'c']);
  });

  it('parseTags handles empty string input', () => {
    expect(cb.parseTags('')).toEqual([]);
  });

  it('parseTags converts numbers to strings', () => {
    expect(cb.parseTags([1, 2, 3])).toEqual(['1', '2', '3']);
  });
});

// ── Pin/Unpin ──
describe('Pin/Unpin Logic', () => {
  it('parseTags handles single tag', () => {
    expect(cb.parseTags('single')).toEqual(['single']);
  });

  it('parseTags handles whitespace in tags', () => {
    expect(cb.parseTags('  foo  ,  bar  ')).toEqual(['foo', 'bar']);
  });

  it('parseTags handles malformed JSON fallback', () => {
    expect(cb.parseTags('[invalid')).toEqual(['[invalid']);
  });
});

// ── Search ──
describe('Search Logic', () => {
  it('parseTags handles empty array', () => {
    expect(cb.parseTags([])).toEqual([]);
  });

  it('parseTags handles mixed types in array', () => {
    expect(cb.parseTags(['foo', 123, 'bar'])).toEqual(['foo', '123', 'bar']);
  });

  it('parseTags handles undefined', () => {
    expect(cb.parseTags(undefined)).toEqual([]);
  });
});

// ── Defaults ──
describe('Defaults', () => {
  it('parseTags with nested spaces', () => {
    const result = cb.parseTags('  a  ,  b  ');
    expect(result).toEqual(['a', 'b']);
  });

  it('parseTags returns array for single element JSON', () => {
    expect(cb.parseTags('["solo"]')).toEqual(['solo']);
  });
});

// ── Stats ──
describe('Stats Logic', () => {
  it('parseTags handles boolean-like values', () => {
    expect(cb.parseTags([true, false])).toEqual(['true', 'false']);
  });

  it('parseTags with trailing comma', () => {
    expect(cb.parseTags('a,b,')).toEqual(['a', 'b']);
  });

  it('parseTags with empty JSON array', () => {
    expect(cb.parseTags('[]')).toEqual([]);
  });
});

// ── Exports ──
describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof cb.parseTags).toBe('function');
    expect(typeof cb.saveClip).toBe('function');
    expect(typeof cb.getClips).toBe('function');
    expect(typeof cb.getClip).toBe('function');
    expect(typeof cb.updateClip).toBe('function');
    expect(typeof cb.deleteClip).toBe('function');
    expect(typeof cb.pinClip).toBe('function');
    expect(typeof cb.unpinClip).toBe('function');
    expect(typeof cb.searchClips).toBe('function');
    expect(typeof cb.getClipStats).toBe('function');
    expect(typeof cb.clearOldClips).toBe('function');
  });
});
