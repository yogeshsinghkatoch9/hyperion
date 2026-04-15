import { describe, it, expect } from 'vitest';

const dv = require('../services/dataViewer');

// ── CSV Parsing ──
describe('CSV Parsing', () => {
  it('parses simple CSV', () => {
    const result = dv.parseCSV('name,age\nAlice,30\nBob,25');
    expect(result.headers).toEqual(['name', 'age']);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].name).toBe('Alice');
  });

  it('handles quoted fields with commas', () => {
    const result = dv.parseCSV('name,city\n"Doe, John","New York"');
    expect(result.rows[0].name).toBe('Doe, John');
  });

  it('returns empty for empty input', () => {
    const result = dv.parseCSV('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });

  it('handles null input', () => {
    const result = dv.parseCSV(null);
    expect(result.headers).toEqual([]);
  });
});

// ── JSON Parsing ──
describe('JSON Parsing', () => {
  it('parses JSON array', () => {
    const result = dv.parseJSON('[{"name":"Alice","age":30},{"name":"Bob","age":25}]');
    expect(result.headers).toContain('name');
    expect(result.rows).toHaveLength(2);
  });

  it('parses JSON object as key-value', () => {
    const result = dv.parseJSON('{"foo":"bar","baz":42}');
    expect(result.headers).toEqual(['key', 'value']);
    expect(result.rows).toHaveLength(2);
  });

  it('handles empty array', () => {
    const result = dv.parseJSON('[]');
    expect(result.rows).toEqual([]);
  });
});

// ── Format Detection ──
describe('Format Detection', () => {
  it('detects CSV', () => {
    expect(dv.detectFormat('a,b,c\n1,2,3')).toBe('csv');
  });

  it('detects TSV', () => {
    expect(dv.detectFormat('a\tb\tc\n1\t2\t3')).toBe('tsv');
  });

  it('detects JSON', () => {
    expect(dv.detectFormat('[{"a":1}]')).toBe('json');
  });
});

// ── Filter Operators ──
describe('Filter Operators', () => {
  const rows = [
    { name: 'Alice', age: '30' },
    { name: 'Bob', age: '25' },
    { name: 'Charlie', age: '35' },
  ];

  it('filters by equals', () => {
    const result = dv.filterRows(rows, 'name', 'equals', 'Alice');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alice');
  });

  it('filters by contains', () => {
    const result = dv.filterRows(rows, 'name', 'contains', 'li');
    expect(result).toHaveLength(2); // Alice, Charlie
  });

  it('filters by gt (greater than)', () => {
    const result = dv.filterRows(rows, 'age', 'gt', '28');
    expect(result).toHaveLength(2);
  });

  it('filters by startsWith', () => {
    const result = dv.filterRows(rows, 'name', 'startsWith', 'Ch');
    expect(result).toHaveLength(1);
  });
});

// ── Sort ──
describe('Sort', () => {
  const rows = [
    { name: 'Charlie', val: '3' },
    { name: 'Alice', val: '1' },
    { name: 'Bob', val: '2' },
  ];

  it('sorts ascending by string', () => {
    const result = dv.sortRows(rows, 'name', 'asc');
    expect(result[0].name).toBe('Alice');
  });

  it('sorts descending by string', () => {
    const result = dv.sortRows(rows, 'name', 'desc');
    expect(result[0].name).toBe('Charlie');
  });

  it('sorts numerically when values are numbers', () => {
    const result = dv.sortRows(rows, 'val', 'asc');
    expect(result[0].val).toBe('1');
  });
});

// ── Aggregate ──
describe('Aggregate', () => {
  const rows = [
    { name: 'A', score: '10' },
    { name: 'B', score: '20' },
    { name: 'C', score: '30' },
    { name: 'A', score: '40' },
  ];

  it('calculates sum', () => {
    expect(dv.aggregate(rows, 'score', 'sum')).toBe(100);
  });

  it('calculates avg', () => {
    expect(dv.aggregate(rows, 'score', 'avg')).toBe(25);
  });

  it('calculates count', () => {
    expect(dv.aggregate(rows, 'name', 'count')).toBe(4);
  });

  it('calculates distinct', () => {
    expect(dv.aggregate(rows, 'name', 'distinct')).toBe(3);
  });
});

// ── Paginate ──
describe('Paginate', () => {
  it('returns correct page slice', () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const result = dv.paginate(rows, 2, 10);
    expect(result.rows).toHaveLength(10);
    expect(result.rows[0].id).toBe(10);
    expect(result.totalPages).toBe(5);
  });
});

// ── Export CSV ──
describe('Export CSV', () => {
  it('exports headers and rows', () => {
    const csv = dv.exportCSV(['name', 'age'], [{ name: 'Alice', age: '30' }]);
    expect(csv).toContain('name,age');
    expect(csv).toContain('Alice,30');
  });
});

// ── Exports ──
describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof dv.detectFormat).toBe('function');
    expect(typeof dv.parseCSV).toBe('function');
    expect(typeof dv.parseJSON).toBe('function');
    expect(typeof dv.filterRows).toBe('function');
    expect(typeof dv.sortRows).toBe('function');
    expect(typeof dv.aggregate).toBe('function');
    expect(typeof dv.paginate).toBe('function');
    expect(typeof dv.exportCSV).toBe('function');
    expect(typeof dv.saveDataSet).toBe('function');
    expect(typeof dv.getDataSets).toBe('function');
    expect(typeof dv.deleteDataSet).toBe('function');
  });
});
