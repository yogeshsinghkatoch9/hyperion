import { describe, it, expect } from 'vitest';
const rx = require('../services/regexTester');

describe('Regex Validation', () => {
  it('accepts valid regex', () => {
    expect(rx.validateRegex('\\d+', 'g')).toEqual({ valid: true, error: null });
  });
  it('rejects invalid regex', () => {
    const r = rx.validateRegex('[unclosed', '');
    expect(r.valid).toBe(false);
    expect(r.error).toBeTruthy();
  });
  it('accepts valid flags', () => {
    expect(rx.validateRegex('abc', 'gi').valid).toBe(true);
  });
  it('rejects invalid flags', () => {
    expect(rx.validateRegex('abc', 'z').valid).toBe(false);
  });
});

describe('Match Extraction', () => {
  it('finds all matches', () => {
    const r = rx.testRegex('\\d+', 'g', 'abc 123 def 456');
    expect(r.matchCount).toBe(2);
    expect(r.matches[0].match).toBe('123');
    expect(r.matches[1].match).toBe('456');
  });
  it('returns match indices', () => {
    const r = rx.testRegex('world', 'g', 'hello world');
    expect(r.matches[0].index).toBe(6);
    expect(r.matches[0].length).toBe(5);
  });
  it('captures groups', () => {
    const r = rx.testRegex('(\\w+)@(\\w+)', 'g', 'user@host');
    expect(r.matches[0].groups).toEqual(['user', 'host']);
  });
  it('returns empty for no match', () => {
    const r = rx.testRegex('xyz', 'g', 'abc');
    expect(r.matchCount).toBe(0);
    expect(r.matches).toHaveLength(0);
  });
});

describe('Replace', () => {
  it('replaces matches', () => {
    const r = rx.replaceRegex('\\d+', 'g', 'a1 b2 c3', 'X');
    expect(r.result).toBe('aX bX cX');
  });
  it('replaces first match without g flag', () => {
    const r = rx.replaceRegex('\\d+', '', 'a1 b2', 'X');
    expect(r.result).toBe('aX b2');
  });
  it('handles backreferences', () => {
    const r = rx.replaceRegex('(\\w+)', 'g', 'hello', '[$1]');
    expect(r.result).toBe('[hello]');
  });
});

describe('Split', () => {
  it('splits text by pattern', () => {
    const r = rx.splitRegex('[,;]', 'g', 'a,b;c');
    expect(r.parts).toEqual(['a', 'b', 'c']);
    expect(r.count).toBe(3);
  });
  it('splits by whitespace', () => {
    const r = rx.splitRegex('\\s+', '', 'hello   world');
    expect(r.parts).toEqual(['hello', 'world']);
  });
  it('returns original when no match', () => {
    const r = rx.splitRegex('Z', '', 'abc');
    expect(r.parts).toEqual(['abc']);
  });
});

describe('Common Patterns', () => {
  it('returns preset patterns array', () => {
    const patterns = rx.getCommonPatterns();
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThan(5);
  });
  it('each pattern has name, pattern, flags', () => {
    const p = rx.getCommonPatterns()[0];
    expect(p).toHaveProperty('name');
    expect(p).toHaveProperty('pattern');
    expect(p).toHaveProperty('flags');
  });
});

describe('Escape', () => {
  it('escapes special characters', () => {
    expect(rx.escapeRegex('a.b*c')).toBe('a\\.b\\*c');
  });
  it('escapes brackets', () => {
    expect(rx.escapeRegex('[test]')).toBe('\\[test\\]');
  });
  it('leaves normal characters unchanged', () => {
    expect(rx.escapeRegex('hello')).toBe('hello');
  });
});

describe('Explain', () => {
  it('explains character classes', () => {
    const r = rx.explainRegex('\\d+');
    expect(r.tokens).toEqual(expect.arrayContaining([
      expect.objectContaining({ token: '\\d' }),
    ]));
  });
  it('explains groups', () => {
    const r = rx.explainRegex('(abc)');
    const groupStart = r.tokens.find(t => t.token === '(');
    expect(groupStart).toBeTruthy();
  });
  it('explains quantifiers', () => {
    const r = rx.explainRegex('a{2,5}');
    const quant = r.tokens.find(t => t.token === '{2,5}');
    expect(quant).toBeTruthy();
  });
});

describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof rx.testRegex).toBe('function');
    expect(typeof rx.replaceRegex).toBe('function');
    expect(typeof rx.splitRegex).toBe('function');
    expect(typeof rx.explainRegex).toBe('function');
    expect(typeof rx.validateRegex).toBe('function');
    expect(typeof rx.getCommonPatterns).toBe('function');
    expect(typeof rx.escapeRegex).toBe('function');
    expect(typeof rx.savePattern).toBe('function');
    expect(typeof rx.getPatterns).toBe('function');
    expect(typeof rx.deletePattern).toBe('function');
  });
});

describe('Edge Cases', () => {
  it('handles empty text', () => {
    const r = rx.testRegex('abc', 'g', '');
    expect(r.matchCount).toBe(0);
  });
});
