import { describe, it, expect } from 'vitest';

const appDiscovery = require('../services/appDiscovery');
const { resolveAppName, fuzzyMatch, isBrowser, levenshtein, APP_ALIASES, BROWSERS } = appDiscovery;

// ── resolveAppName: static aliases (no FS needed) ──
describe('resolveAppName — aliases', () => {
  it('resolves "chrome" to "Google Chrome"', () => {
    expect(resolveAppName('chrome')).toBe('Google Chrome');
  });
  it('resolves "vscode" to "Visual Studio Code"', () => {
    expect(resolveAppName('vscode')).toBe('Visual Studio Code');
  });
  it('is case-insensitive', () => {
    expect(resolveAppName('CHROME')).toBe('Google Chrome');
  });
  it('resolves multi-word aliases', () => {
    expect(resolveAppName('vs code')).toBe('Visual Studio Code');
  });
  it('resolves "slack" to "Slack"', () => {
    expect(resolveAppName('slack')).toBe('Slack');
  });
  it('returns input string for unknown apps', () => {
    const result = resolveAppName('nonexistentapp99999');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── isBrowser ──
describe('isBrowser', () => {
  it('returns true for known browsers', () => {
    expect(isBrowser('Google Chrome')).toBe(true);
    expect(isBrowser('Safari')).toBe(true);
    expect(isBrowser('Firefox')).toBe(true);
    expect(isBrowser('Brave Browser')).toBe(true);
  });
  it('returns false for non-browser apps', () => {
    expect(isBrowser('Slack')).toBe(false);
    expect(isBrowser('Finder')).toBe(false);
  });
  it('returns false for undefined/null', () => {
    expect(isBrowser(undefined)).toBe(false);
    expect(isBrowser(null)).toBe(false);
  });
});

// ── levenshtein ──
describe('levenshtein', () => {
  it('identical strings return 0', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });
  it('single char difference returns 1', () => {
    expect(levenshtein('abc', 'abd')).toBe(1);
  });
  it('completely different strings', () => {
    expect(levenshtein('abc', 'xyz')).toBe(3);
  });
  it('empty vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('test', '')).toBe(4);
  });
  it('empty vs empty returns 0', () => {
    expect(levenshtein('', '')).toBe(0);
  });
});

// ── fuzzyMatch ──
describe('fuzzyMatch', () => {
  it('exact alias returns confidence 1.0', () => {
    const r = fuzzyMatch('firefox');
    expect(r.confidence).toBe(1.0);
    expect(r.name).toBe('Firefox');
  });
  it('no match returns confidence 0', () => {
    const r = fuzzyMatch('zzzzqqqq99999');
    expect(r.confidence).toBe(0);
    expect(r.source).toBe('none');
  });
  it('handles empty/null input', () => {
    expect(fuzzyMatch('').confidence).toBe(0);
    expect(fuzzyMatch(null).confidence).toBe(0);
  });
});

// ── APP_ALIASES & BROWSERS ──
describe('Constants', () => {
  it('APP_ALIASES has many entries', () => {
    expect(Object.keys(APP_ALIASES).length).toBeGreaterThan(30);
  });
  it('BROWSERS is a Set with known browsers', () => {
    expect(BROWSERS instanceof Set).toBe(true);
    expect(BROWSERS.size).toBeGreaterThan(3);
  });
});

// ── Module exports ──
describe('Module exports', () => {
  it('exports all expected functions', () => {
    expect(typeof resolveAppName).toBe('function');
    expect(typeof fuzzyMatch).toBe('function');
    expect(typeof isBrowser).toBe('function');
    expect(typeof levenshtein).toBe('function');
  });
});
