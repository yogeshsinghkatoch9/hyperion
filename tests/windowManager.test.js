import { describe, it, expect } from 'vitest';

const { moveWindowScript, sideBySide, minimizeAll, getScreenSize, POSITIONS } = require('../services/windowManager');

// ── POSITIONS (pure functions, no mocking needed) ──
describe('POSITIONS', () => {
  it('has all 10 position keys', () => {
    const keys = ['left half','right half','top half','bottom half','top left','top right','bottom left','bottom right','fullscreen','center'];
    for (const k of keys) expect(POSITIONS).toHaveProperty(k);
  });

  it('each position is a function', () => {
    for (const fn of Object.values(POSITIONS)) expect(typeof fn).toBe('function');
  });

  it('left half: {0, 0, 960, 1080}', () => {
    expect(POSITIONS['left half'](1920, 1080)).toBe('{0, 0, 960, 1080}');
  });

  it('right half: {960, 0, 1920, 1080}', () => {
    expect(POSITIONS['right half'](1920, 1080)).toBe('{960, 0, 1920, 1080}');
  });

  it('fullscreen: {0, 0, 1920, 1080}', () => {
    expect(POSITIONS['fullscreen'](1920, 1080)).toBe('{0, 0, 1920, 1080}');
  });

  it('center: quarter insets', () => {
    expect(POSITIONS['center'](1920, 1080)).toBe('{480, 270, 1440, 810}');
  });

  it('top left: {0, 0, 960, 540}', () => {
    expect(POSITIONS['top left'](1920, 1080)).toBe('{0, 0, 960, 540}');
  });

  it('bottom right: {960, 540, 1920, 1080}', () => {
    expect(POSITIONS['bottom right'](1920, 1080)).toBe('{960, 540, 1920, 1080}');
  });
});

// ── moveWindowScript ──
describe('moveWindowScript', () => {
  it('returns osascript command for valid position', () => {
    const cmd = moveWindowScript('Safari', 'left half');
    expect(cmd).toContain('osascript');
    expect(cmd).toContain('Safari');
  });

  it('returns error for unknown position', () => {
    const cmd = moveWindowScript('Safari', 'upside down');
    expect(cmd).toContain('echo');
    expect(cmd).toContain('Unknown position');
  });

  it('is case-insensitive for position', () => {
    const cmd = moveWindowScript('Safari', 'Left Half');
    expect(cmd).toContain('osascript');
  });
});

// ── sideBySide ──
describe('sideBySide', () => {
  it('includes both app names', () => {
    const cmd = sideBySide('Chrome', 'Safari');
    expect(cmd).toContain('Chrome');
    expect(cmd).toContain('Safari');
  });

  it('returns osascript command', () => {
    const cmd = sideBySide('A', 'B');
    expect(cmd).toContain('osascript');
  });
});

// ── minimizeAll ──
describe('minimizeAll', () => {
  it('returns osascript command', () => {
    const cmd = minimizeAll();
    expect(cmd).toContain('osascript');
    expect(cmd).toContain('visible');
  });
});

// ── getScreenSize ──
describe('getScreenSize', () => {
  it('returns object with width and height', () => {
    const size = getScreenSize();
    expect(size).toHaveProperty('width');
    expect(size).toHaveProperty('height');
    expect(typeof size.width).toBe('number');
    expect(typeof size.height).toBe('number');
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  });
});

// ── Module exports ──
describe('Module exports', () => {
  it('exports all expected functions', () => {
    expect(typeof moveWindowScript).toBe('function');
    expect(typeof sideBySide).toBe('function');
    expect(typeof minimizeAll).toBe('function');
    expect(typeof getScreenSize).toBe('function');
    expect(typeof POSITIONS).toBe('object');
  });
});
