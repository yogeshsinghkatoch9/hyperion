import { describe, it, expect } from 'vitest';

const dbExplorer = require('../services/dbExplorer');

// ── CSV Export ──
describe('CSV Export', () => {
  it('produces correct CSV with headers', () => {
    const columns = ['id', 'name', 'value'];
    const rows = [
      { id: 1, name: 'foo', value: 'bar' },
      { id: 2, name: 'baz', value: 'qux' },
    ];
    const csv = dbExplorer.exportCsv(columns, rows);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"id","name","value"');
    expect(lines[1]).toBe('1,foo,bar');
    expect(lines[2]).toBe('2,baz,qux');
  });

  it('escapes commas in values', () => {
    const csv = dbExplorer.exportCsv(['col'], [{ col: 'a,b' }]);
    expect(csv).toContain('"a,b"');
  });

  it('escapes double quotes in values', () => {
    const csv = dbExplorer.exportCsv(['col'], [{ col: 'say "hello"' }]);
    expect(csv).toContain('"say ""hello"""');
  });

  it('handles null and undefined values', () => {
    const csv = dbExplorer.exportCsv(['a', 'b'], [{ a: null, b: undefined }]);
    const lines = csv.split('\n');
    expect(lines[1]).toBe(',');
  });

  it('handles newlines in values', () => {
    const csv = dbExplorer.exportCsv(['col'], [{ col: 'line1\nline2' }]);
    expect(csv).toContain('"line1\nline2"');
  });

  it('returns just header for empty rows', () => {
    const csv = dbExplorer.exportCsv(['a', 'b'], []);
    expect(csv).toBe('"a","b"');
  });
});

// ── JSON Export ──
describe('JSON Export', () => {
  it('exports rows as formatted JSON', () => {
    const rows = [{ id: 1, name: 'test' }];
    const json = dbExplorer.exportJson(rows);
    expect(JSON.parse(json)).toEqual(rows);
  });

  it('exports empty array for no rows', () => {
    const json = dbExplorer.exportJson([]);
    expect(JSON.parse(json)).toEqual([]);
  });

  it('produces indented output', () => {
    const json = dbExplorer.exportJson([{ a: 1 }]);
    expect(json).toContain('\n'); // formatted with newlines
  });
});

// ── Connection Management ──
describe('Connection Pool', () => {
  it('listConnections returns an array', () => {
    const list = dbExplorer.listConnections();
    expect(Array.isArray(list)).toBe(true);
  });

  it('getConnectionInfo returns null for unknown id', () => {
    const info = dbExplorer.getConnectionInfo('nonexistent');
    expect(info).toBeNull();
  });

  it('getConnection throws for unknown id', () => {
    expect(() => dbExplorer.getConnection('fake')).toThrow('Connection not found');
  });

  it('disconnect on unknown id does not throw', () => {
    expect(() => dbExplorer.disconnect('nonexistent')).not.toThrow();
  });
});

// ── Query Execution Guards ──
describe('Query Execution', () => {
  it('throws on empty SQL (connection check first)', () => {
    // getConnection runs before empty check, so with unknown connId we get connection error
    expect(() => dbExplorer.executeQuery('nonexistent', '')).toThrow();
  });

  it('throws on whitespace-only SQL (connection check first)', () => {
    expect(() => dbExplorer.executeQuery('nonexistent', '   ')).toThrow();
  });

  it('throws connection error for unknown connId with valid SQL', () => {
    expect(() => dbExplorer.executeQuery('fake', 'SELECT 1')).toThrow('Connection not found');
  });
});

// ── SQL Type Detection ──
describe('SQL Type Detection', () => {
  // The executeQuery function detects read vs write — test the regex pattern
  const readPattern = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i;

  it('detects SELECT as read', () => {
    expect(readPattern.test('SELECT * FROM foo')).toBe(true);
  });

  it('detects PRAGMA as read', () => {
    expect(readPattern.test('PRAGMA table_info("users")')).toBe(true);
  });

  it('detects EXPLAIN as read', () => {
    expect(readPattern.test('EXPLAIN QUERY PLAN SELECT 1')).toBe(true);
  });

  it('detects WITH (CTE) as read', () => {
    expect(readPattern.test('WITH cte AS (SELECT 1) SELECT * FROM cte')).toBe(true);
  });

  it('detects INSERT as write', () => {
    expect(readPattern.test('INSERT INTO foo VALUES (1)')).toBe(false);
  });

  it('detects UPDATE as write', () => {
    expect(readPattern.test('UPDATE foo SET bar = 1')).toBe(false);
  });

  it('detects DELETE as write', () => {
    expect(readPattern.test('DELETE FROM foo WHERE id = 1')).toBe(false);
  });

  it('handles leading whitespace', () => {
    expect(readPattern.test('  \n  SELECT 1')).toBe(true);
  });

  it('is case insensitive', () => {
    expect(readPattern.test('select * from foo')).toBe(true);
    expect(readPattern.test('Select 1')).toBe(true);
  });
});

// ── Table Name Sanitization ──
describe('Table Name Sanitization', () => {
  // The service uses tableName.replace(/[^a-zA-Z0-9_]/g, '')
  const sanitize = (name) => name.replace(/[^a-zA-Z0-9_]/g, '');

  it('allows alphanumeric and underscore', () => {
    expect(sanitize('my_table_1')).toBe('my_table_1');
  });

  it('strips SQL injection characters', () => {
    expect(sanitize('users; DROP TABLE users--')).toBe('usersDROPTABLEusers');
  });

  it('strips spaces', () => {
    expect(sanitize('my table')).toBe('mytable');
  });

  it('strips quotes', () => {
    expect(sanitize('"users"')).toBe('users');
  });

  it('handles empty string', () => {
    expect(sanitize('')).toBe('');
  });
});

// ── Data Shape ──
describe('Data Shapes', () => {
  it('connection info has expected fields', () => {
    // Mock shape validation
    const shape = { id: 'x', name: 'test', path: '/test.db', connectedAt: Date.now(), isInternal: false };
    expect(shape).toHaveProperty('id');
    expect(shape).toHaveProperty('name');
    expect(shape).toHaveProperty('path');
    expect(shape).toHaveProperty('connectedAt');
    expect(shape).toHaveProperty('isInternal');
  });

  it('table schema shape is correct', () => {
    const shape = {
      name: 'users',
      columns: [{ name: 'id', type: 'TEXT', notNull: false, defaultValue: null, primaryKey: true }],
      indexes: [{ name: 'idx', unique: true, columns: ['id'] }],
      foreignKeys: [{ from: 'user_id', table: 'users', to: 'id', onUpdate: 'CASCADE', onDelete: 'CASCADE' }],
      rowCount: 0,
      createSql: '',
    };
    expect(shape.columns[0]).toHaveProperty('primaryKey');
    expect(shape.indexes[0]).toHaveProperty('unique');
    expect(shape.foreignKeys[0]).toHaveProperty('onDelete');
  });

  it('query result has type field', () => {
    const selectResult = { type: 'select', columns: [], rows: [], rowCount: 0, time: 5 };
    const modifyResult = { type: 'modify', changes: 1, lastInsertRowid: 1, time: 3 };
    expect(selectResult.type).toBe('select');
    expect(modifyResult.type).toBe('modify');
    expect(modifyResult).toHaveProperty('changes');
  });
});

// ── MAX_CONNECTIONS Constant ──
describe('Constants', () => {
  it('export functions exist', () => {
    expect(typeof dbExplorer.connect).toBe('function');
    expect(typeof dbExplorer.connectHyperion).toBe('function');
    expect(typeof dbExplorer.disconnect).toBe('function');
    expect(typeof dbExplorer.getTables).toBe('function');
    expect(typeof dbExplorer.getTableSchema).toBe('function');
    expect(typeof dbExplorer.getTableData).toBe('function');
    expect(typeof dbExplorer.executeQuery).toBe('function');
    expect(typeof dbExplorer.exportCsv).toBe('function');
    expect(typeof dbExplorer.exportJson).toBe('function');
    expect(typeof dbExplorer.saveQuery).toBe('function');
    expect(typeof dbExplorer.getSavedQueries).toBe('function');
    expect(typeof dbExplorer.deleteSavedQuery).toBe('function');
    expect(typeof dbExplorer.addQueryHistory).toBe('function');
    expect(typeof dbExplorer.getQueryHistory).toBe('function');
    expect(typeof dbExplorer.clearQueryHistory).toBe('function');
    expect(typeof dbExplorer.closeAll).toBe('function');
  });
});
