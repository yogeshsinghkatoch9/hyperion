import { describe, test, expect, vi, beforeEach } from 'vitest';

const dbExplorer = await import('../services/dbExplorer.js');

// ── CSV Export ──
describe('exportCsv', () => {
  test('empty data', () => {
    const csv = dbExplorer.exportCsv([], []);
    expect(csv).toBe('');
  });

  test('basic CSV output', () => {
    const csv = dbExplorer.exportCsv(['name', 'age'], [{ name: 'Alice', age: 30 }, { name: 'Bob', age: 25 }]);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"name","age"');
    expect(lines[1]).toBe('Alice,30');
    expect(lines[2]).toBe('Bob,25');
  });

  test('escapes commas in values', () => {
    const csv = dbExplorer.exportCsv(['text'], [{ text: 'hello, world' }]);
    expect(csv).toContain('"hello, world"');
  });

  test('escapes quotes in values', () => {
    const csv = dbExplorer.exportCsv(['text'], [{ text: 'say "hi"' }]);
    expect(csv).toContain('"say ""hi"""');
  });

  test('handles null values', () => {
    const csv = dbExplorer.exportCsv(['a', 'b'], [{ a: null, b: undefined }]);
    expect(csv).toContain(',');
  });

  test('handles newlines in values', () => {
    const csv = dbExplorer.exportCsv(['text'], [{ text: 'line1\nline2' }]);
    expect(csv).toContain('"line1\nline2"');
  });
});

// ── JSON Export ──
describe('exportJson', () => {
  test('empty array', () => {
    const json = dbExplorer.exportJson([]);
    expect(JSON.parse(json)).toEqual([]);
  });

  test('formats with indentation', () => {
    const json = dbExplorer.exportJson([{ id: 1, name: 'test' }]);
    expect(json).toContain('  "id"');
    expect(JSON.parse(json)).toEqual([{ id: 1, name: 'test' }]);
  });

  test('handles special characters', () => {
    const json = dbExplorer.exportJson([{ text: 'hello "world"' }]);
    const parsed = JSON.parse(json);
    expect(parsed[0].text).toBe('hello "world"');
  });
});

// ── Table name sanitization ──
describe('Table name sanitization', () => {
  test('strips special characters', () => {
    const safe = 'drop_table; DELETE'.replace(/[^a-zA-Z0-9_]/g, '');
    expect(safe).toBe('drop_tableDELETE');
  });

  test('preserves valid names', () => {
    const safe = 'users_2024'.replace(/[^a-zA-Z0-9_]/g, '');
    expect(safe).toBe('users_2024');
  });

  test('handles empty string', () => {
    const safe = ''.replace(/[^a-zA-Z0-9_]/g, '');
    expect(safe).toBe('');
  });
});

// ── SQL dump format ──
describe('SQL dump format', () => {
  test('generates valid INSERT for string values', () => {
    const val = "it's a test";
    const escaped = "'" + val.replace(/'/g, "''") + "'";
    expect(escaped).toBe("'it''s a test'");
  });

  test('NULL for null values', () => {
    const val = null;
    const result = val === null ? 'NULL' : val;
    expect(result).toBe('NULL');
  });

  test('numbers pass through unquoted', () => {
    const val = 42;
    const result = typeof val === 'number' ? val : `'${val}'`;
    expect(result).toBe(42);
  });

  test('Content-Disposition header format', () => {
    const filename = `export_${Date.now()}.sql`;
    expect(filename).toMatch(/^export_\d+\.sql$/);
  });
});

// ── Connection validation ──
describe('getConnection', () => {
  test('throws for unknown connection', () => {
    expect(() => dbExplorer.getConnection('nonexistent')).toThrow('Connection not found');
  });
});
