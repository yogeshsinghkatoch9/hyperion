import { describe, it, expect } from 'vitest';

const snippets = require('../services/snippets');

// ── Language Normalization ──
describe('Language Normalization', () => {
  it('normalizes js → javascript', () => {
    expect(snippets.normalizeLanguage('js')).toBe('javascript');
  });
  it('normalizes ts → typescript', () => {
    expect(snippets.normalizeLanguage('ts')).toBe('typescript');
  });
  it('normalizes py → python', () => {
    expect(snippets.normalizeLanguage('py')).toBe('python');
  });
  it('normalizes sh → bash', () => {
    expect(snippets.normalizeLanguage('sh')).toBe('bash');
  });
  it('normalizes yml → yaml', () => {
    expect(snippets.normalizeLanguage('yml')).toBe('yaml');
  });
  it('normalizes c++ → cpp', () => {
    expect(snippets.normalizeLanguage('c++')).toBe('cpp');
  });
  it('normalizes c# → csharp', () => {
    expect(snippets.normalizeLanguage('c#')).toBe('csharp');
  });
  it('keeps known language as-is', () => {
    expect(snippets.normalizeLanguage('python')).toBe('python');
  });
  it('defaults unknown to text', () => {
    expect(snippets.normalizeLanguage('brainfuck')).toBe('text');
  });
  it('defaults null to text', () => {
    expect(snippets.normalizeLanguage(null)).toBe('text');
  });
});

// ── Language Validation ──
describe('Language Validation', () => {
  it('accepts valid language', () => {
    expect(snippets.isValidLanguage('javascript')).toBe(true);
  });
  it('rejects unknown language', () => {
    expect(snippets.isValidLanguage('cobol')).toBe(false);
  });
  it('handles null', () => {
    expect(snippets.isValidLanguage(null)).toBe(false);
  });
});

// ── LANGUAGES constant ──
describe('LANGUAGES', () => {
  it('has common languages', () => {
    expect(snippets.LANGUAGES).toContain('javascript');
    expect(snippets.LANGUAGES).toContain('python');
    expect(snippets.LANGUAGES).toContain('go');
    expect(snippets.LANGUAGES).toContain('rust');
  });
  it('has 30+ languages', () => {
    expect(snippets.LANGUAGES.length).toBeGreaterThan(30);
  });
});

// ── Create Guards ──
describe('Create Guards', () => {
  it('rejects empty name', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    expect(() => snippets.createSnippet(mockDb, { name: '', code: 'x' })).toThrow('Name required');
  });
  it('rejects missing code', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    expect(() => snippets.createSnippet(mockDb, { name: 'test' })).toThrow('Code required');
  });
});

// ── Get Guards ──
describe('Get Guards', () => {
  it('throws when not found', () => {
    const mockDb = { prepare: () => ({ get: () => null }) };
    expect(() => snippets.getSnippet(mockDb, 'nonexistent')).toThrow('not found');
  });
});

// ── Delete Guards ──
describe('Delete Guards', () => {
  it('throws when not found', () => {
    const mockDb = { prepare: () => ({ run: () => ({ changes: 0 }) }) };
    expect(() => snippets.deleteSnippet(mockDb, 'nonexistent')).toThrow('not found');
  });
});

// ── Export Format ──
describe('Export Format', () => {
  it('exports JSON', () => {
    const mockDb = { prepare: () => ({ all: () => [] }) };
    const result = snippets.exportSnippets(mockDb, 'json');
    expect(JSON.parse(result)).toEqual([]);
  });
  it('exports CSV with header', () => {
    const mockDb = { prepare: () => ({ all: () => [] }) };
    const result = snippets.exportSnippets(mockDb, 'csv');
    expect(result).toContain('name,language,tags,code');
  });
});

// ── Import Guards ──
describe('Import Guards', () => {
  it('rejects non-array', () => {
    const mockDb = {};
    expect(() => snippets.importSnippets(mockDb, 'not json')).toThrow();
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'isValidLanguage', 'normalizeLanguage',
      'createSnippet', 'getSnippet', 'updateSnippet', 'deleteSnippet', 'listSnippets',
      'getAllTags', 'exportSnippets', 'importSnippets', 'getStats',
    ];
    for (const fn of fns) {
      expect(typeof snippets[fn]).toBe('function');
    }
  });
});
