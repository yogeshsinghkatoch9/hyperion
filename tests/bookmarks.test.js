import { describe, it, expect } from 'vitest';

const bm = require('../services/bookmarks');

// ── URL Validation ──
describe('URL Validation', () => {
  it('accepts https URL', () => {
    expect(bm.isValidUrl('https://example.com')).toBe(true);
  });
  it('accepts http URL', () => {
    expect(bm.isValidUrl('http://example.com')).toBe(true);
  });
  it('rejects ftp URL', () => {
    expect(bm.isValidUrl('ftp://example.com')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(bm.isValidUrl('')).toBe(false);
  });
  it('rejects null', () => {
    expect(bm.isValidUrl(null)).toBe(false);
  });
});

// ── Favicon Builder ──
describe('Favicon Builder', () => {
  it('builds Google favicon URL', () => {
    const url = bm.getFaviconUrl('https://github.com/test');
    expect(url).toContain('google.com/s2/favicons');
    expect(url).toContain('github.com');
  });
  it('returns empty for invalid URL', () => {
    expect(bm.getFaviconUrl('not-a-url')).toBe('');
  });
  it('returns empty for null', () => {
    expect(bm.getFaviconUrl(null)).toBe('');
  });
});

// ── Duplicate Detection ──
describe('Duplicate Detection', () => {
  it('detects existing URL', () => {
    const mockDb = { prepare: () => ({ get: () => ({ id: '1' }) }) };
    expect(bm.isDuplicate(mockDb, 'https://example.com')).toBe(true);
  });
  it('returns false for new URL', () => {
    const mockDb = { prepare: () => ({ get: () => null }) };
    expect(bm.isDuplicate(mockDb, 'https://new.com')).toBe(false);
  });
  it('create rejects duplicate', () => {
    const mockDb = {
      prepare: (sql) => {
        if (sql.includes('SELECT')) return { get: () => ({ id: '1' }) };
        return { run: () => {} };
      },
    };
    expect(() => bm.createBookmark(mockDb, { url: 'https://example.com' })).toThrow('already exists');
  });
});

// ── Tag Extraction ──
describe('Tag Extraction', () => {
  it('parses array tags', () => {
    expect(bm.parseTags(['Dev', 'Tools'])).toEqual(['dev', 'tools']);
  });
  it('parses JSON string tags', () => {
    expect(bm.parseTags('["a","b"]')).toEqual(['a', 'b']);
  });
  it('parses comma-separated tags', () => {
    expect(bm.parseTags('dev, tools, api')).toEqual(['dev', 'tools', 'api']);
  });
});

// ── Import Format ──
describe('Import Format', () => {
  it('rejects non-array', () => {
    const mockDb = {};
    expect(() => bm.importBookmarks(mockDb, 'not an array')).toThrow('must be an array');
  });
  it('skips invalid URLs', () => {
    const mockDb = { prepare: () => ({ get: () => null, run: () => {} }) };
    const result = bm.importBookmarks(mockDb, [{ url: 'not-valid' }]);
    expect(result.skipped).toBe(1);
    expect(result.imported).toBe(0);
  });
  it('imports valid bookmarks', () => {
    const mockDb = { prepare: () => ({ get: () => null, run: () => {} }) };
    const result = bm.importBookmarks(mockDb, [{ url: 'https://example.com', title: 'Example' }]);
    expect(result.imported).toBe(1);
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'isValidUrl', 'getFaviconUrl', 'parseTags', 'isDuplicate',
      'createBookmark', 'getBookmarks', 'getBookmark', 'updateBookmark',
      'deleteBookmark', 'searchBookmarks', 'getTags', 'exportBookmarks', 'importBookmarks',
    ];
    for (const fn of fns) {
      expect(typeof bm[fn]).toBe('function');
    }
  });
});
