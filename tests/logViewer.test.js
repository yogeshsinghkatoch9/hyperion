import { describe, it, expect } from 'vitest';

const logViewer = require('../services/logViewer');

// ── Level Detection ──
describe('Log Level Detection', () => {
  it('detects ERROR level', () => {
    expect(logViewer.detectLevel('[ERROR] Something failed')).toBe('error');
    expect(logViewer.detectLevel('FATAL: crash')).toBe('error');
    expect(logViewer.detectLevel('CRITICAL failure')).toBe('error');
    expect(logViewer.detectLevel('panic: runtime error')).toBe('error');
  });

  it('detects WARN level', () => {
    expect(logViewer.detectLevel('[WARN] Slow query')).toBe('warn');
    expect(logViewer.detectLevel('WARNING: deprecated API')).toBe('warn');
  });

  it('detects INFO level', () => {
    expect(logViewer.detectLevel('[INFO] Server started')).toBe('info');
    expect(logViewer.detectLevel('INFO: Connection established')).toBe('info');
  });

  it('detects DEBUG level', () => {
    expect(logViewer.detectLevel('[DEBUG] Variable state')).toBe('debug');
    expect(logViewer.detectLevel('TRACE: entering function')).toBe('debug');
    expect(logViewer.detectLevel('VERBOSE: detailed output')).toBe('debug');
  });

  it('returns default for regular lines', () => {
    expect(logViewer.detectLevel('Just a regular line')).toBe('default');
    expect(logViewer.detectLevel('2024-01-01 Starting up')).toBe('default');
  });

  it('handles empty/null', () => {
    expect(logViewer.detectLevel('')).toBe('default');
    expect(logViewer.detectLevel(null)).toBe('default');
    expect(logViewer.detectLevel(undefined)).toBe('default');
  });

  it('is case insensitive', () => {
    expect(logViewer.detectLevel('error: test')).toBe('error');
    expect(logViewer.detectLevel('Error: test')).toBe('error');
  });
});

// ── Level Colors ──
describe('Level Colors', () => {
  it('returns correct colors', () => {
    expect(logViewer.getLevelColor('error')).toBe('red');
    expect(logViewer.getLevelColor('warn')).toBe('amber');
    expect(logViewer.getLevelColor('info')).toBe('green');
    expect(logViewer.getLevelColor('debug')).toBe('dim');
    expect(logViewer.getLevelColor('default')).toBe('text');
  });

  it('handles unknown levels', () => {
    expect(logViewer.getLevelColor('custom')).toBe('text');
    expect(logViewer.getLevelColor(null)).toBe('text');
  });
});

// ── File Operations ──
describe('File Operations', () => {
  it('throws on non-existent file', () => {
    expect(() => logViewer.readLogFile('/nonexistent/file.log')).toThrow('File not found');
  });

  it('throws on directory', () => {
    expect(() => logViewer.readLogFile('/tmp')).toThrow('Path is a directory');
  });

  it('searchInFile throws on non-existent file', () => {
    expect(() => logViewer.searchInFile('/nonexistent/file.log', 'pattern')).toThrow('File not found');
  });
});

// ── Common Log Paths ──
describe('Common Log Paths', () => {
  it('returns an array', () => {
    const paths = logViewer.getCommonLogPaths();
    expect(Array.isArray(paths)).toBe(true);
  });

  it('only returns existing directories', () => {
    const paths = logViewer.getCommonLogPaths();
    const fs = require('fs');
    for (const p of paths) {
      expect(fs.existsSync(p)).toBe(true);
    }
  });
});

// ── Log File Discovery ──
describe('Log Discovery', () => {
  it('findLogFiles returns an array', () => {
    const files = logViewer.findLogFiles('/tmp');
    expect(Array.isArray(files)).toBe(true);
  });

  it('respects maxDepth limit', () => {
    // Should not crash on deeply nested structures
    expect(() => logViewer.findLogFiles('/tmp', { maxDepth: 1 })).not.toThrow();
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all expected functions', () => {
    expect(typeof logViewer.readLogFile).toBe('function');
    expect(typeof logViewer.detectLevel).toBe('function');
    expect(typeof logViewer.getLevelColor).toBe('function');
    expect(typeof logViewer.startTailing).toBe('function');
    expect(typeof logViewer.stopTailing).toBe('function');
    expect(typeof logViewer.stopAllTailing).toBe('function');
    expect(typeof logViewer.findLogFiles).toBe('function');
    expect(typeof logViewer.getCommonLogPaths).toBe('function');
    expect(typeof logViewer.searchInFile).toBe('function');
  });
});
