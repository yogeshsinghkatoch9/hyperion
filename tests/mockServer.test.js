import { describe, it, expect } from 'vitest';

const mock = require('../services/mockServer');

// ── Route Matching ──
describe('Route Matching', () => {
  it('matches exact path', () => {
    const result = mock.matchRoute('/api/users', '/api/users');
    expect(result).toEqual({});
  });
  it('extracts path params', () => {
    const result = mock.matchRoute('/api/users/:id', '/api/users/123');
    expect(result).toEqual({ id: '123' });
  });
  it('extracts multiple params', () => {
    const result = mock.matchRoute('/api/:resource/:id', '/api/posts/42');
    expect(result).toEqual({ resource: 'posts', id: '42' });
  });
  it('returns null for no match', () => {
    expect(mock.matchRoute('/api/users', '/api/posts')).toBeNull();
  });
  it('returns null for different length', () => {
    expect(mock.matchRoute('/api/users', '/api/users/123')).toBeNull();
  });
});

// ── Status Code Validation ──
describe('Status Code Validation', () => {
  it('accepts 200', () => {
    expect(mock.isValidStatus(200)).toBe(true);
  });
  it('accepts 404', () => {
    expect(mock.isValidStatus(404)).toBe(true);
  });
  it('rejects 600', () => {
    expect(mock.isValidStatus(600)).toBe(false);
  });
});

// ── Delay Validation ──
describe('Delay Validation', () => {
  it('accepts 0', () => {
    expect(mock.isValidDelay(0)).toBe(true);
  });
  it('accepts 5000', () => {
    expect(mock.isValidDelay(5000)).toBe(true);
  });
  it('rejects negative', () => {
    expect(mock.isValidDelay(-1)).toBe(false);
  });
});

// ── Response Building ──
describe('Response Building', () => {
  it('builds basic response', () => {
    const ep = { status: 200, body: '{"ok":true}', headers: {}, delay_ms: 0 };
    const r = mock.buildResponse(ep, {});
    expect(r.status).toBe(200);
    expect(r.body).toBe('{"ok":true}');
  });
  it('replaces path params in body', () => {
    const ep = { status: 200, body: 'User :id', headers: {}, delay_ms: 0 };
    const r = mock.buildResponse(ep, { id: '42' });
    expect(r.body).toBe('User 42');
  });
  it('auto-detects JSON content type', () => {
    const ep = { status: 200, body: '{"a":1}', headers: {}, delay_ms: 0 };
    const r = mock.buildResponse(ep, {});
    expect(r.headers['Content-Type']).toBe('application/json');
  });
  it('auto-detects HTML content type', () => {
    const ep = { status: 200, body: '<html></html>', headers: {}, delay_ms: 0 };
    const r = mock.buildResponse(ep, {});
    expect(r.headers['Content-Type']).toBe('text/html');
  });
});

// ── Path Sanitization ──
describe('Path Sanitization', () => {
  it('adds leading slash', () => {
    expect(mock.sanitizePath('api/users')).toBe('/api/users');
  });
  it('removes double slashes', () => {
    expect(mock.sanitizePath('//api//users')).toBe('/api/users');
  });
  it('removes trailing slash', () => {
    expect(mock.sanitizePath('/api/users/')).toBe('/api/users');
  });
  it('handles null', () => {
    expect(mock.sanitizePath(null)).toBe('/');
  });
});

// ── Content-Type Auto-Detection ──
describe('Content-Type Detection', () => {
  it('detects array JSON', () => {
    const ep = { status: 200, body: '[1,2,3]', headers: {}, delay_ms: 0 };
    const r = mock.buildResponse(ep, {});
    expect(r.headers['Content-Type']).toBe('application/json');
  });
  it('defaults to text/plain', () => {
    const ep = { status: 200, body: 'plain text', headers: {}, delay_ms: 0 };
    const r = mock.buildResponse(ep, {});
    expect(r.headers['Content-Type']).toBe('text/plain');
  });
  it('preserves explicit content-type', () => {
    const ep = { status: 200, body: 'data', headers: { 'Content-Type': 'application/xml' }, delay_ms: 0 };
    const r = mock.buildResponse(ep, {});
    expect(r.headers['Content-Type']).toBe('application/xml');
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'sanitizePath', 'matchRoute', 'buildResponse', 'isValidStatus', 'isValidDelay',
      'createEndpoint', 'getEndpoints', 'getEndpoint', 'updateEndpoint', 'deleteEndpoint',
      'startServer', 'stopServer', 'getServerStatus', 'getRequestLog', 'clearRequestLog',
    ];
    for (const fn of fns) {
      expect(typeof mock[fn]).toBe('function');
    }
  });
});
