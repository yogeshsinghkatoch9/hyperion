import { describe, it, expect } from 'vitest';

const md = require('../services/markdownEditor');

// ── Title Extraction ──
describe('Title Extraction', () => {
  it('extracts first H1', () => {
    expect(md.extractTitle('# Hello World')).toBe('Hello World');
  });
  it('extracts from multiline', () => {
    expect(md.extractTitle('intro\n# My Title\nbody')).toBe('My Title');
  });
  it('returns empty for no heading', () => {
    expect(md.extractTitle('no heading here')).toBe('');
  });
  it('handles null', () => {
    expect(md.extractTitle(null)).toBe('');
  });
});

// ── Headings Extraction ──
describe('Headings Extraction', () => {
  it('extracts multiple levels', () => {
    const headings = md.extractHeadings('# H1\n## H2\n### H3');
    expect(headings).toHaveLength(3);
    expect(headings[0]).toEqual({ level: 1, text: 'H1' });
    expect(headings[1]).toEqual({ level: 2, text: 'H2' });
  });
  it('returns empty for no headings', () => {
    expect(md.extractHeadings('plain text')).toHaveLength(0);
  });
  it('handles null', () => {
    expect(md.extractHeadings(null)).toHaveLength(0);
  });
});

// ── Word Count ──
describe('Word Count', () => {
  it('counts simple words', () => {
    expect(md.wordCount('hello world')).toBe(2);
  });
  it('ignores markdown syntax', () => {
    expect(md.wordCount('**bold** *italic*')).toBe(2);
  });
  it('returns 0 for empty', () => {
    expect(md.wordCount('')).toBe(0);
  });
  it('returns 0 for null', () => {
    expect(md.wordCount(null)).toBe(0);
  });
});

// ── Read Time ──
describe('Read Time', () => {
  it('returns 1 min for short text', () => {
    expect(md.readTime('hello')).toBe(1);
  });
  it('calculates for longer text', () => {
    const words = Array(500).fill('word').join(' ');
    expect(md.readTime(words)).toBe(3);
  });
});

// ── Markdown to HTML ──
describe('Markdown to HTML', () => {
  it('converts H1', () => {
    expect(md.markdownToHtml('# Title')).toContain('<h1>Title</h1>');
  });
  it('converts bold', () => {
    expect(md.markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
  });
  it('converts italic', () => {
    expect(md.markdownToHtml('*italic*')).toContain('<em>italic</em>');
  });
  it('converts links', () => {
    const html = md.markdownToHtml('[text](http://example.com)');
    expect(html).toContain('<a href="http://example.com">text</a>');
  });
  it('converts code blocks', () => {
    const html = md.markdownToHtml('```js\nconsole.log(1)\n```');
    expect(html).toContain('<pre><code');
  });
  it('handles null', () => {
    expect(md.markdownToHtml(null)).toBe('');
  });
});

// ── HTML Export Template ──
describe('HTML Export Template', () => {
  it('wraps in full HTML document', () => {
    const html = md.exportHtml('# Test', 'My Doc');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>My Doc</title>');
  });
  it('auto-extracts title from content', () => {
    const html = md.exportHtml('# Auto Title');
    expect(html).toContain('<title>Auto Title</title>');
  });
});

// ── Doc Stats ──
describe('Doc Stats', () => {
  it('returns stats object', () => {
    const stats = md.getDocStats('# Title\n\nhello world test');
    expect(stats.words).toBeGreaterThan(0);
    expect(stats.chars).toBeGreaterThan(0);
    expect(stats.readTime).toBeGreaterThanOrEqual(1);
    expect(stats.headings).toBe(1);
  });
  it('handles empty doc', () => {
    const stats = md.getDocStats('');
    expect(stats.words).toBe(0);
    expect(stats.lines).toBeLessThanOrEqual(1);
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'extractTitle', 'extractHeadings', 'wordCount', 'charCount',
      'readTime', 'getDocStats', 'markdownToHtml', 'exportHtml',
      'createNote', 'getNotes', 'getNote', 'updateNote', 'deleteNote', 'searchNotes',
    ];
    for (const fn of fns) {
      expect(typeof md[fn]).toBe('function');
    }
  });
});
