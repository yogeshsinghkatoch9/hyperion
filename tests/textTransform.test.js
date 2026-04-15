import { describe, it, expect } from 'vitest';

const tt = require('../services/textTransform');

// ── Case Transforms ──
describe('Case Transforms', () => {
  it('converts to uppercase', () => {
    expect(tt.toUpperCase('hello world')).toBe('HELLO WORLD');
  });

  it('converts to lowercase', () => {
    expect(tt.toLowerCase('HELLO WORLD')).toBe('hello world');
  });

  it('converts to title case', () => {
    expect(tt.toTitleCase('hello world')).toBe('Hello World');
  });

  it('converts to camelCase', () => {
    expect(tt.toCamelCase('hello world')).toBe('helloWorld');
  });

  it('converts to snake_case', () => {
    expect(tt.toSnakeCase('helloWorld')).toBe('hello_world');
  });

  it('converts to kebab-case', () => {
    expect(tt.toKebabCase('helloWorld')).toBe('hello-world');
  });

  it('converts to PascalCase', () => {
    expect(tt.toPascalCase('hello world')).toBe('HelloWorld');
  });

  it('converts to CONSTANT_CASE', () => {
    expect(tt.toConstantCase('helloWorld')).toBe('HELLO_WORLD');
  });
});

// ── Line Operations ──
describe('Line Operations', () => {
  it('sorts lines ascending', () => {
    expect(tt.sortLines('c\na\nb', 'asc')).toBe('a\nb\nc');
  });

  it('reverses lines', () => {
    expect(tt.reverseLines('a\nb\nc')).toBe('c\nb\na');
  });

  it('deduplicates lines', () => {
    expect(tt.deduplicateLines('a\nb\na\nc\nb')).toBe('a\nb\nc');
  });

  it('numbers lines', () => {
    const result = tt.numberLines('foo\nbar');
    expect(result).toBe('1. foo\n2. bar');
  });

  it('removes empty lines', () => {
    expect(tt.removeEmptyLines('a\n\nb\n\nc')).toBe('a\nb\nc');
  });
});

// ── Text Utils ──
describe('Text Utils', () => {
  it('reverses text', () => {
    expect(tt.reverseText('hello')).toBe('olleh');
  });

  it('counts words', () => {
    expect(tt.countWords('hello world foo')).toBe(3);
  });

  it('counts characters', () => {
    expect(tt.countChars('hello')).toBe(5);
  });

  it('counts lines', () => {
    expect(tt.countLines('a\nb\nc')).toBe(3);
  });
});

// ── Encode/Decode ──
describe('Encode/Decode', () => {
  it('encodes rot13', () => {
    expect(tt.rot13('hello')).toBe('uryyb');
  });

  it('rot13 is its own inverse', () => {
    expect(tt.rot13(tt.rot13('hello'))).toBe('hello');
  });

  it('encodes to morse code', () => {
    const morse = tt.toMorseCode('SOS');
    expect(morse).toBe('... --- ...');
  });
});

// ── Generators ──
describe('Generators', () => {
  it('generates lorem ipsum', () => {
    const result = tt.loremIpsum(2);
    expect(result.length).toBeGreaterThan(50);
    expect(result.split('\n\n').length).toBe(2);
  });

  it('generates password of specified length', () => {
    const pwd = tt.generatePassword(20);
    expect(pwd).toHaveLength(20);
  });

  it('generates password with only lowercase', () => {
    const pwd = tt.generatePassword(50, { uppercase: false, numbers: false, symbols: false });
    expect(pwd).toMatch(/^[a-z]+$/);
  });
});

// ── Extractors ──
describe('Extractors', () => {
  it('extracts emails', () => {
    const emails = tt.extractEmails('Contact us at test@example.com or info@foo.org');
    expect(emails).toHaveLength(2);
    expect(emails).toContain('test@example.com');
  });

  it('extracts URLs', () => {
    const urls = tt.extractUrls('Visit https://example.com and http://foo.bar/path');
    expect(urls).toHaveLength(2);
  });
});

// ── Extract Numbers ──
describe('Extract Numbers', () => {
  it('extracts numbers from text', () => {
    const nums = tt.extractNumbers('I have 3 cats and 2.5 dogs and -1 bird');
    expect(nums).toContain(3);
    expect(nums).toContain(2.5);
    expect(nums).toContain(-1);
  });
});

// ── Transform Registry ──
describe('Transform Registry', () => {
  it('lists available transforms', () => {
    const list = tt.listTransforms();
    expect(list).toContain('toUpperCase');
    expect(list).toContain('rot13');
    expect(list.length).toBeGreaterThan(20);
  });

  it('applies transform by name', () => {
    expect(tt.applyTransform('toUpperCase', 'hello')).toBe('HELLO');
  });

  it('throws for unknown transform', () => {
    expect(() => tt.applyTransform('nonexistent', 'text')).toThrow('Unknown transform');
  });
});

// ── Edge Cases ──
describe('Edge Cases', () => {
  it('handles null input for case transforms', () => {
    expect(tt.toUpperCase(null)).toBe('');
    expect(tt.toLowerCase(null)).toBe('');
  });

  it('handles empty string for line ops', () => {
    expect(tt.sortLines('')).toBe('');
    expect(tt.reverseLines('')).toBe('');
  });

  it('counts 0 words for empty string', () => {
    expect(tt.countWords('')).toBe(0);
  });

  it('counts 0 lines for empty string', () => {
    expect(tt.countLines('')).toBe(0);
  });
});

// ── Exports ──
describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof tt.toUpperCase).toBe('function');
    expect(typeof tt.toCamelCase).toBe('function');
    expect(typeof tt.sortLines).toBe('function');
    expect(typeof tt.rot13).toBe('function');
    expect(typeof tt.loremIpsum).toBe('function');
    expect(typeof tt.extractEmails).toBe('function');
    expect(typeof tt.listTransforms).toBe('function');
    expect(typeof tt.applyTransform).toBe('function');
    expect(typeof tt.TRANSFORMS).toBe('object');
  });
});
