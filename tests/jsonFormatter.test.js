import { describe, it, expect } from 'vitest';
const jf = require('../services/jsonFormatter');

describe('Format', () => {
  it('formats JSON with indent 2 by default', () => {
    const input = '{"a":1,"b":2}';
    const result = jf.format(input);
    expect(result).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it('formats JSON with indent 4', () => {
    const input = '{"a":1}';
    const result = jf.format(input, 4);
    expect(result).toBe('{\n    "a": 1\n}');
  });

  it('throws for invalid JSON input', () => {
    expect(() => jf.format('not json')).toThrow();
  });
});

describe('Minify', () => {
  it('removes all whitespace from JSON', () => {
    const input = '{\n  "a": 1,\n  "b": 2\n}';
    expect(jf.minify(input)).toBe('{"a":1,"b":2}');
  });

  it('minify of already minified JSON returns the same', () => {
    const input = '{"x":true}';
    expect(jf.minify(input)).toBe('{"x":true}');
  });
});

describe('Validate', () => {
  it('returns valid:true for valid JSON', () => {
    const result = jf.validate('{"a": 1}');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns valid:false with error message for invalid JSON', () => {
    const result = jf.validate('{invalid}');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTypeOf('string');
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('validates arrays as valid JSON', () => {
    expect(jf.validate('[1,2,3]').valid).toBe(true);
  });

  it('validates primitives as valid JSON', () => {
    expect(jf.validate('"hello"').valid).toBe(true);
    expect(jf.validate('42').valid).toBe(true);
    expect(jf.validate('true').valid).toBe(true);
    expect(jf.validate('null').valid).toBe(true);
  });
});

describe('Sort Keys', () => {
  it('sorts top-level keys alphabetically', () => {
    const input = '{"c":3,"a":1,"b":2}';
    const result = JSON.parse(jf.sortKeys(input));
    const keys = Object.keys(result);
    expect(keys).toEqual(['a', 'b', 'c']);
  });

  it('sorts nested object keys recursively', () => {
    const input = '{"z":{"b":2,"a":1},"y":0}';
    const result = JSON.parse(jf.sortKeys(input));
    expect(Object.keys(result)).toEqual(['y', 'z']);
    expect(Object.keys(result.z)).toEqual(['a', 'b']);
  });

  it('preserves array order while sorting object keys inside arrays', () => {
    const input = '{"arr":[{"z":1,"a":2}]}';
    const result = JSON.parse(jf.sortKeys(input));
    expect(Object.keys(result.arr[0])).toEqual(['a', 'z']);
  });
});

describe('Diff', () => {
  it('finds additions', () => {
    const a = '{"x":1}';
    const b = '{"x":1,"y":2}';
    const diffs = jf.diff(a, b);
    const addition = diffs.find(d => d.type === 'added');
    expect(addition).toBeTruthy();
    expect(addition.path).toBe('y');
    expect(addition.newValue).toBe(2);
  });

  it('finds removals', () => {
    const a = '{"x":1,"y":2}';
    const b = '{"x":1}';
    const diffs = jf.diff(a, b);
    const removal = diffs.find(d => d.type === 'removed');
    expect(removal).toBeTruthy();
    expect(removal.path).toBe('y');
    expect(removal.oldValue).toBe(2);
  });

  it('finds changes', () => {
    const a = '{"x":1}';
    const b = '{"x":99}';
    const diffs = jf.diff(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
    expect(diffs[0].oldValue).toBe(1);
    expect(diffs[0].newValue).toBe(99);
  });

  it('returns empty array for identical JSON', () => {
    const json = '{"a":1,"b":[2,3]}';
    const diffs = jf.diff(json, json);
    expect(diffs).toEqual([]);
  });

  it('detects nested changes', () => {
    const a = '{"obj":{"nested":"old"}}';
    const b = '{"obj":{"nested":"new"}}';
    const diffs = jf.diff(a, b);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].path).toBe('obj.nested');
  });

  it('detects array element additions', () => {
    const a = '{"arr":[1,2]}';
    const b = '{"arr":[1,2,3]}';
    const diffs = jf.diff(a, b);
    const addition = diffs.find(d => d.type === 'added');
    expect(addition).toBeTruthy();
    expect(addition.newValue).toBe(3);
  });
});

describe('Query', () => {
  it('traverses dot notation', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(jf.query(obj, 'a.b.c')).toBe(42);
  });

  it('handles array index with bracket notation', () => {
    const obj = { items: ['zero', 'one', 'two'] };
    expect(jf.query(obj, 'items[1]')).toBe('one');
  });

  it('handles mixed dot and bracket notation', () => {
    const obj = { users: [{ name: 'Alice' }, { name: 'Bob' }] };
    expect(jf.query(obj, 'users[1].name')).toBe('Bob');
  });

  it('returns undefined for non-existent path', () => {
    const obj = { a: 1 };
    expect(jf.query(obj, 'b.c.d')).toBeUndefined();
  });

  it('returns entire object for empty path', () => {
    const obj = { a: 1 };
    expect(jf.query(obj, '')).toEqual({ a: 1 });
  });
});

describe('Flatten / Unflatten', () => {
  it('flatten creates dot-notation keys', () => {
    const obj = { a: { b: 1, c: 2 } };
    const flat = jf.flatten(obj);
    expect(flat['a.b']).toBe(1);
    expect(flat['a.c']).toBe(2);
  });

  it('flatten uses bracket notation for arrays', () => {
    const obj = { items: ['x', 'y'] };
    const flat = jf.flatten(obj);
    expect(flat['items[0]']).toBe('x');
    expect(flat['items[1]']).toBe('y');
  });

  it('unflatten reconstructs a nested object', () => {
    const flat = { 'a.b': 1, 'a.c': 2, 'd': 3 };
    const result = jf.unflatten(flat);
    expect(result).toEqual({ a: { b: 1, c: 2 }, d: 3 });
  });

  it('flatten then unflatten roundtrip preserves structure', () => {
    const obj = { x: { y: [1, 2, 3] }, z: 'hello' };
    const flat = jf.flatten(obj);
    const restored = jf.unflatten(flat);
    expect(restored.x.y[0]).toBe(1);
    expect(restored.x.y[1]).toBe(2);
    expect(restored.x.y[2]).toBe(3);
    expect(restored.z).toBe('hello');
  });
});

describe('getStats', () => {
  it('returns correct counts for a simple object', () => {
    const stats = jf.getStats('{"a":1,"b":"two","c":null}');
    expect(stats.keys).toBe(3);
    expect(stats.objects).toBe(1);
    expect(stats.nulls).toBe(1);
    expect(stats.arrays).toBe(0);
  });

  it('counts nested depth correctly', () => {
    const stats = jf.getStats('{"a":{"b":{"c":1}}}');
    expect(stats.depth).toBeGreaterThanOrEqual(3);
  });

  it('counts arrays', () => {
    const stats = jf.getStats('{"list":[1,2,3]}');
    expect(stats.arrays).toBe(1);
  });

  it('reports size in bytes', () => {
    const input = '{"a":1}';
    const stats = jf.getStats(input);
    expect(stats.size).toBe(Buffer.byteLength(input, 'utf8'));
  });
});

describe('Edge Cases', () => {
  it('handles empty object', () => {
    const stats = jf.getStats('{}');
    expect(stats.keys).toBe(0);
    expect(stats.objects).toBe(1);
  });

  it('handles empty array', () => {
    const stats = jf.getStats('[]');
    expect(stats.arrays).toBe(1);
    expect(stats.keys).toBe(0);
  });
});
