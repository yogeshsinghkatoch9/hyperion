/**
 * Validation Middleware Tests
 */
import { describe, test, expect } from 'vitest';

const { validate, sanitize } = require('../services/validation');

function mockReqRes(body = {}) {
  const req = { body };
  const res = {
    _status: 200, _json: null,
    status(s) { this._status = s; return this; },
    json(j) { this._json = j; return this; },
  };
  const next = () => { res._next = true; };
  return { req, res, next };
}

describe('validate middleware', () => {
  test('passes when all required fields present', () => {
    const mw = validate({ name: { type: 'string', required: true } });
    const { req, res, next } = mockReqRes({ name: 'Alice' });
    mw(req, res, next);
    expect(res._next).toBe(true);
  });

  test('rejects missing required field', () => {
    const mw = validate({ name: { type: 'string', required: true } });
    const { req, res, next } = mockReqRes({});
    mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.error).toBe('Validation failed');
    expect(res._json.details).toContain('name is required');
  });

  test('rejects wrong type', () => {
    const mw = validate({ age: { type: 'number' } });
    const { req, res, next } = mockReqRes({ age: 'twenty' });
    mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.details).toContain('age must be of type number');
  });

  test('validates string min length', () => {
    const mw = validate({ pass: { type: 'string', min: 6 } });
    const { req, res, next } = mockReqRes({ pass: 'abc' });
    mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.details[0]).toContain('at least 6');
  });

  test('validates string max length', () => {
    const mw = validate({ tag: { type: 'string', max: 5 } });
    const { req, res, next } = mockReqRes({ tag: 'toolong' });
    mw(req, res, next);
    expect(res._status).toBe(400);
  });

  test('validates string pattern', () => {
    const mw = validate({ email: { type: 'string', pattern: /^.+@.+\..+$/ } });
    const { req, res, next } = mockReqRes({ email: 'notanemail' });
    mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.details[0]).toContain('format is invalid');
  });

  test('validates number min/max', () => {
    const mw = validate({ count: { type: 'number', min: 1, max: 100 } });
    const { req, res, next } = mockReqRes({ count: 0 });
    mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.details[0]).toContain('at least 1');
  });

  test('validates enum values', () => {
    const mw = validate({ role: { type: 'string', enum: ['admin', 'user'] } });
    const { req, res, next } = mockReqRes({ role: 'superadmin' });
    mw(req, res, next);
    expect(res._status).toBe(400);
    expect(res._json.details[0]).toContain('must be one of');
  });

  test('validates array type and min items', () => {
    const mw = validate({ tags: { type: 'array', min: 1 } });
    const { req, res, next } = mockReqRes({ tags: [] });
    mw(req, res, next);
    expect(res._status).toBe(400);
  });

  test('skips optional missing fields', () => {
    const mw = validate({ bio: { type: 'string', min: 1 } });
    const { req, res, next } = mockReqRes({});
    mw(req, res, next);
    expect(res._next).toBe(true);
  });

  test('collects multiple errors', () => {
    const mw = validate({
      name: { type: 'string', required: true },
      age: { type: 'number', required: true },
    });
    const { req, res, next } = mockReqRes({});
    mw(req, res, next);
    expect(res._json.details.length).toBe(2);
  });

  test('handles null body gracefully', () => {
    const mw = validate({ x: { type: 'string' } });
    const { req, res, next } = mockReqRes(undefined);
    req.body = undefined;
    mw(req, res, next);
    expect(res._next).toBe(true);
  });
});

describe('sanitize middleware', () => {
  test('trims whitespace from specified fields', () => {
    const mw = sanitize(['name']);
    const { req, res, next } = mockReqRes({ name: '  Alice  ' });
    mw(req, res, next);
    expect(req.body.name).toBe('Alice');
    expect(res._next).toBe(true);
  });

  test('strips control characters', () => {
    const mw = sanitize(['text']);
    const { req, res, next } = mockReqRes({ text: 'hello\x00world\x1F' });
    mw(req, res, next);
    expect(req.body.text).toBe('helloworld');
  });

  test('ignores non-string fields', () => {
    const mw = sanitize(['count']);
    const { req, res, next } = mockReqRes({ count: 42 });
    mw(req, res, next);
    expect(req.body.count).toBe(42);
    expect(res._next).toBe(true);
  });

  test('handles missing body', () => {
    const mw = sanitize(['name']);
    const { req, res, next } = mockReqRes();
    req.body = undefined;
    mw(req, res, next);
    expect(res._next).toBe(true);
  });
});
