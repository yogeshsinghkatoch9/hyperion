import { describe, it, expect } from 'vitest';

const notes = require('../services/notes');

// ── Create Guards ──
describe('Create Guards', () => {
  it('rejects empty note', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    expect(() => notes.createNote(mockDb, {})).toThrow('required');
  });
  it('rejects no title and no content', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    expect(() => notes.createNote(mockDb, { title: '', content: '' })).toThrow('required');
  });
  it('accepts title only', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    const result = notes.createNote(mockDb, { title: 'Test' });
    expect(result.title).toBe('Test');
    expect(result.id).toBeDefined();
  });
});

// ── Color Validation ──
describe('Color Validation', () => {
  it('accepts valid colors', () => {
    expect(notes.isValidColor('default')).toBe(true);
    expect(notes.isValidColor('red')).toBe(true);
    expect(notes.isValidColor('green')).toBe(true);
    expect(notes.isValidColor('blue')).toBe(true);
  });
  it('rejects invalid color', () => {
    expect(notes.isValidColor('pink')).toBe(false);
  });
  it('rejects null', () => {
    expect(notes.isValidColor(null)).toBe(false);
  });
  it('defaults to default color on create', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    const result = notes.createNote(mockDb, { title: 'Test', color: 'invalid' });
    expect(result.color).toBe('default');
  });
});

// ── Pin Toggle ──
describe('Pin Toggle', () => {
  it('pins unpinned note', () => {
    const mockDb = {
      prepare: (sql) => {
        if (sql.includes('SELECT')) return { get: () => ({ id: '1', pinned: 0, title: 'Test', content: '', color: 'default' }) };
        return { run: () => {} };
      },
    };
    const result = notes.togglePin(mockDb, '1');
    expect(result.pinned).toBe(true);
  });
  it('unpins pinned note', () => {
    const mockDb = {
      prepare: (sql) => {
        if (sql.includes('SELECT')) return { get: () => ({ id: '1', pinned: 1, title: 'Test', content: '', color: 'default' }) };
        return { run: () => {} };
      },
    };
    const result = notes.togglePin(mockDb, '1');
    expect(result.pinned).toBe(false);
  });
  it('throws for missing note', () => {
    const mockDb = { prepare: () => ({ get: () => null }) };
    expect(() => notes.togglePin(mockDb, 'nonexistent')).toThrow('not found');
  });
});

// ── Search ──
describe('Search', () => {
  it('returns all when no query', () => {
    const mockDb = {
      prepare: () => ({ all: (...args) => args.length === 0 ? [{ id: '1' }] : [] }),
    };
    const results = notes.searchNotes(mockDb, '');
    expect(Array.isArray(results)).toBe(true);
  });
  it('searches with query', () => {
    const mockDb = {
      prepare: () => ({ all: () => [{ id: '1', title: 'Test' }] }),
    };
    const results = notes.searchNotes(mockDb, 'test');
    expect(results).toHaveLength(1);
  });
  it('handles null query', () => {
    const mockDb = {
      prepare: () => ({ all: (...args) => args.length === 0 ? [] : [] }),
    };
    const results = notes.searchNotes(mockDb, null);
    expect(Array.isArray(results)).toBe(true);
  });
});

// ── Sort Order ──
describe('Sort Order', () => {
  it('VALID_COLORS has 6 options', () => {
    expect(notes.VALID_COLORS).toHaveLength(6);
  });
  it('VALID_COLORS includes default', () => {
    expect(notes.VALID_COLORS).toContain('default');
  });
  it('VALID_COLORS includes all expected colors', () => {
    expect(notes.VALID_COLORS).toContain('red');
    expect(notes.VALID_COLORS).toContain('green');
    expect(notes.VALID_COLORS).toContain('blue');
    expect(notes.VALID_COLORS).toContain('amber');
    expect(notes.VALID_COLORS).toContain('purple');
  });
});

// ── Defaults ──
describe('Defaults', () => {
  it('returns default color', () => {
    const defaults = notes.getDefaults();
    expect(defaults.color).toBe('default');
  });
  it('returns pinned false', () => {
    const defaults = notes.getDefaults();
    expect(defaults.pinned).toBe(false);
  });
  it('returns colors array', () => {
    const defaults = notes.getDefaults();
    expect(defaults.colors).toHaveLength(6);
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'isValidColor', 'createNote', 'getNotes', 'getNote',
      'updateNote', 'deleteNote', 'togglePin', 'searchNotes', 'getDefaults',
    ];
    for (const fn of fns) {
      expect(typeof notes[fn]).toBe('function');
    }
  });
});
