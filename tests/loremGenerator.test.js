import { describe, it, expect } from 'vitest';
const lorem = require('../services/loremGenerator');

describe('Words', () => {
  it('returns the correct number of words', () => {
    const result = lorem.words(5);
    const count = result.split(' ').length;
    expect(count).toBe(5);
  });

  it('returns a string', () => {
    expect(typeof lorem.words(3)).toBe('string');
  });

  it('returns empty string for 0 words', () => {
    expect(lorem.words(0)).toBe('');
  });

  it('returns a single word when count is 1', () => {
    const result = lorem.words(1);
    expect(result.split(' ')).toHaveLength(1);
  });

  it('returns 10 words by default pattern', () => {
    const result = lorem.words(10);
    expect(result.split(' ')).toHaveLength(10);
  });
});

describe('Sentences', () => {
  it('returns the correct number of sentences', () => {
    const result = lorem.sentences(3);
    const count = result.split('. ').length;
    // Each sentence ends with '.', last one has no trailing '. '
    // Counting periods at end gives sentence count
    const periods = (result.match(/\./g) || []).length;
    expect(periods).toBe(3);
  });

  it('each sentence ends with a period', () => {
    const result = lorem.sentences(2);
    expect(result.endsWith('.')).toBe(true);
  });

  it('sentences start with an uppercase letter', () => {
    const result = lorem.sentences(1);
    expect(result.charAt(0)).toMatch(/[A-Z]/);
  });

  it('returns a string', () => {
    expect(typeof lorem.sentences(1)).toBe('string');
  });
});

describe('Paragraphs', () => {
  it('returns the correct number of paragraphs', () => {
    const result = lorem.paragraphs(3);
    const count = result.split('\n\n').length;
    expect(count).toBe(3);
  });

  it('each paragraph contains at least one sentence', () => {
    const result = lorem.paragraphs(2);
    const paras = result.split('\n\n');
    for (const p of paras) {
      expect(p).toContain('.');
    }
  });

  it('returns a string', () => {
    expect(typeof lorem.paragraphs(1)).toBe('string');
  });
});

describe('Name', () => {
  it('returns a first and last name separated by space', () => {
    const result = lorem.name();
    expect(result).toContain(' ');
    const parts = result.split(' ');
    expect(parts).toHaveLength(2);
  });

  it('returns a non-empty string', () => {
    expect(lorem.name().length).toBeGreaterThan(0);
  });
});

describe('Email', () => {
  it('contains @ symbol', () => {
    const result = lorem.email();
    expect(result).toContain('@');
  });

  it('has a domain part after @', () => {
    const result = lorem.email();
    const parts = result.split('@');
    expect(parts).toHaveLength(2);
    expect(parts[1]).toContain('.');
  });
});

describe('Phone', () => {
  it('matches US phone format (XXX) XXX-XXXX', () => {
    const result = lorem.phone();
    expect(result).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
  });
});

describe('Address', () => {
  it('returns a non-empty string', () => {
    const result = lorem.address();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('contains a comma separator', () => {
    const result = lorem.address();
    expect(result).toContain(',');
  });
});

describe('Company', () => {
  it('returns a non-empty string', () => {
    const result = lorem.company();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('Date', () => {
  it('returns a Date object', () => {
    const result = lorem.date('2020-01-01', '2025-12-31');
    expect(result instanceof Date).toBe(true);
  });

  it('returns an ISO string between the range', () => {
    const from = '2023-01-01';
    const to = '2023-12-31';
    const result = lorem.date(from, to);
    const iso = result.toISOString();
    expect(iso >= new Date(from).toISOString()).toBe(true);
    expect(iso <= new Date(to).toISOString()).toBe(true);
  });

  it('works with default arguments', () => {
    const result = lorem.date();
    expect(result instanceof Date).toBe(true);
    expect(result.getTime()).toBeGreaterThanOrEqual(new Date('2020-01-01').getTime());
    expect(result.getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('Number', () => {
  it('returns an integer between min and max', () => {
    const result = lorem.number(1, 100);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('returns min when min equals max', () => {
    expect(lorem.number(5, 5)).toBe(5);
  });

  it('with no args returns a number (NaN edge case)', () => {
    const result = lorem.number();
    expect(typeof result).toBe('number');
  });
});

describe('Exports', () => {
  it('exports all expected functions', () => {
    expect(typeof lorem.words).toBe('function');
    expect(typeof lorem.sentences).toBe('function');
    expect(typeof lorem.paragraphs).toBe('function');
    expect(typeof lorem.name).toBe('function');
    expect(typeof lorem.email).toBe('function');
    expect(typeof lorem.phone).toBe('function');
    expect(typeof lorem.address).toBe('function');
    expect(typeof lorem.company).toBe('function');
    expect(typeof lorem.date).toBe('function');
    expect(typeof lorem.number).toBe('function');
  });
});
