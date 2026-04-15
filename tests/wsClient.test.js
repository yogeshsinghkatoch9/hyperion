import { describe, it, expect } from 'vitest';

const ws = require('../services/wsClient');

// ── URL Validation ──
describe('URL Validation', () => {
  it('accepts ws:// URL', () => {
    expect(ws.isValidWsUrl('ws://localhost:8080')).toBe(true);
  });
  it('accepts wss:// URL', () => {
    expect(ws.isValidWsUrl('wss://example.com/ws')).toBe(true);
  });
  it('rejects http:// URL', () => {
    expect(ws.isValidWsUrl('http://example.com')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(ws.isValidWsUrl('')).toBe(false);
  });
  it('rejects null', () => {
    expect(ws.isValidWsUrl(null)).toBe(false);
  });
});

// ── URL Normalization ──
describe('URL Normalization', () => {
  it('adds ws:// prefix', () => {
    expect(ws.normalizeWsUrl('localhost:8080')).toBe('ws://localhost:8080');
  });
  it('keeps existing ws://', () => {
    expect(ws.normalizeWsUrl('ws://localhost')).toBe('ws://localhost');
  });
  it('removes trailing slash', () => {
    expect(ws.normalizeWsUrl('ws://localhost:8080/')).toBe('ws://localhost:8080');
  });
});

// ── Message Type Detection ──
describe('Message Type Detection', () => {
  it('detects JSON object', () => {
    expect(ws.detectMessageType('{"key":"value"}')).toBe('json');
  });
  it('detects JSON array', () => {
    expect(ws.detectMessageType('[1,2,3]')).toBe('json');
  });
  it('detects plain text', () => {
    expect(ws.detectMessageType('hello world')).toBe('text');
  });
  it('detects binary', () => {
    expect(ws.detectMessageType(Buffer.from('hello'))).toBe('binary');
  });
});

// ── Message Formatting ──
describe('Message Formatting', () => {
  it('formats sent message', () => {
    const msg = ws.formatMessage('hello', 'sent');
    expect(msg.direction).toBe('sent');
    expect(msg.payload).toBe('hello');
    expect(msg.type).toBe('text');
    expect(msg.size).toBeGreaterThan(0);
  });
  it('formats received JSON', () => {
    const msg = ws.formatMessage('{"a":1}', 'received');
    expect(msg.type).toBe('json');
    expect(msg.direction).toBe('received');
  });
  it('includes timestamp', () => {
    const msg = ws.formatMessage('test');
    expect(msg.timestamp).toBeDefined();
    expect(msg.timestamp).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

// ── Pretty Print JSON ──
describe('Pretty Print JSON', () => {
  it('formats valid JSON', () => {
    const result = ws.prettyPrintJson('{"a":1}');
    expect(result).toContain('  "a": 1');
  });
  it('formats JSON array', () => {
    const result = ws.prettyPrintJson('[1,2]');
    expect(result).toContain('  1');
  });
  it('returns non-JSON as-is', () => {
    expect(ws.prettyPrintJson('hello')).toBe('hello');
  });
  it('handles null', () => {
    expect(ws.prettyPrintJson(null)).toBe('');
  });
});

// ── Truncate for Summary ──
describe('Truncate for Summary', () => {
  it('truncates long strings', () => {
    const long = 'a'.repeat(200);
    const result = ws.truncateForSummary(long, 50);
    expect(result.length).toBeLessThanOrEqual(52); // 50 + '…'
  });
  it('keeps short strings', () => {
    expect(ws.truncateForSummary('short')).toBe('short');
  });
  it('handles empty input', () => {
    expect(ws.truncateForSummary('')).toBe('');
  });
});

// ── Guards ──
describe('Guards', () => {
  it('save rejects missing URL', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    expect(() => ws.saveConnection(mockDb, {})).toThrow('URL required');
  });
  it('save normalizes http to ws', () => {
    const mockDb = { prepare: () => ({ run: () => {} }) };
    const result = ws.saveConnection(mockDb, { url: 'http://localhost:8080' });
    expect(result.url).toBe('ws://localhost:8080');
  });
  it('getConnection throws when not found', () => {
    const mockDb = { prepare: () => ({ get: () => null }) };
    expect(() => ws.getConnection(mockDb, 'x')).toThrow('not found');
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'isValidWsUrl', 'normalizeWsUrl', 'detectMessageType', 'formatMessage',
      'prettyPrintJson', 'truncateForSummary', 'saveConnection', 'getConnections',
      'getConnection', 'updateConnection', 'deleteConnection', 'touchConnection',
      'addMessage', 'getMessageHistory', 'clearMessageHistory', 'getStats',
    ];
    for (const fn of fns) {
      expect(typeof ws[fn]).toBe('function');
    }
  });
});
