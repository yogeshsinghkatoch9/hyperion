import { describe, test, expect, beforeEach, vi } from 'vitest';

let logger;
let writeSpy;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.LOG_LEVEL;
  delete process.env.LOG_FILE;
  writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  logger = require('../services/logger');
  logger.setLevel('debug'); // start each test at lowest level
});

function lastOutput() {
  const calls = writeSpy.mock.calls;
  if (!calls.length) return null;
  return JSON.parse(calls[calls.length - 1][0]);
}

describe('log level filtering', () => {
  test('debug is hidden when level is info', () => {
    logger.setLevel('info');
    logger.debug('hidden message');
    expect(writeSpy).not.toHaveBeenCalled();
  });

  test('info is visible when level is info', () => {
    logger.setLevel('info');
    logger.info('visible');
    expect(lastOutput().message).toBe('visible');
  });

  test('warn and error visible when level is warn', () => {
    logger.setLevel('warn');
    logger.info('hidden');
    expect(writeSpy).not.toHaveBeenCalled();
    logger.warn('visible warn');
    expect(lastOutput().message).toBe('visible warn');
    logger.error('visible error');
    expect(lastOutput().message).toBe('visible error');
  });
});

describe('level methods', () => {
  test('debug outputs at debug level', () => {
    logger.debug('d');
    expect(lastOutput().level).toBe('debug');
  });

  test('info outputs with level info', () => {
    logger.info('i');
    expect(lastOutput().level).toBe('info');
  });

  test('warn outputs with level warn', () => {
    logger.warn('w');
    expect(lastOutput().level).toBe('warn');
  });

  test('error outputs with level error', () => {
    logger.error('e');
    expect(lastOutput().level).toBe('error');
  });
});

describe('setLevel / getLevel', () => {
  test('setLevel changes current level', () => {
    logger.setLevel('error');
    expect(logger.getLevel()).toBe('error');
  });

  test('getLevel returns default after reset', () => {
    logger.setLevel('info');
    expect(logger.getLevel()).toBe('info');
  });
});

describe('child logger', () => {
  test('child merges context into output', () => {
    const child = logger.child({ module: 'auth' });
    child.info('login');
    const out = lastOutput();
    expect(out.module).toBe('auth');
    expect(out.message).toBe('login');
  });

  test('child preserves parent context and adds its own', () => {
    const child1 = logger.child({ module: 'auth' });
    const child2 = child1.child({ requestId: '123' });
    child2.warn('deep');
    const out = lastOutput();
    expect(out.module).toBe('auth');
    expect(out.requestId).toBe('123');
  });
});

describe('structured output format', () => {
  test('output is valid JSON with timestamp, level, message', () => {
    logger.info('test msg', { extra: 42 });
    const out = lastOutput();
    expect(out).toHaveProperty('timestamp');
    expect(out).toHaveProperty('level', 'info');
    expect(out).toHaveProperty('message', 'test msg');
    expect(out).toHaveProperty('extra', 42);
    expect(() => new Date(out.timestamp)).not.toThrow();
  });

  test('output line ends with newline', () => {
    logger.info('nl check');
    const raw = writeSpy.mock.calls[writeSpy.mock.calls.length - 1][0];
    expect(raw.endsWith('\n')).toBe(true);
  });
});

describe('request logger middleware', () => {
  test('logs method, path, status, duration on finish', () => {
    const req = { method: 'GET', originalUrl: '/api/data' };
    const listeners = {};
    const res = {
      statusCode: 200,
      on: (event, fn) => { listeners[event] = fn; },
      removeListener: vi.fn(),
    };
    const next = vi.fn();

    logger.requestLogger(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    // Simulate response finish
    listeners.finish();
    const out = lastOutput();
    expect(out.method).toBe('GET');
    expect(out.path).toBe('/api/data');
    expect(out.status).toBe(200);
    expect(typeof out.duration).toBe('number');
  });

  test('falls back to req.url when originalUrl is absent', () => {
    const req = { method: 'POST', url: '/fallback' };
    const listeners = {};
    const res = {
      statusCode: 201,
      on: (event, fn) => { listeners[event] = fn; },
      removeListener: vi.fn(),
    };
    logger.requestLogger(req, res, vi.fn());
    listeners.finish();
    expect(lastOutput().path).toBe('/fallback');
  });
});

describe('error serialization', () => {
  test('Error objects are serialized with name, message, stack', () => {
    const err = new Error('boom');
    logger.error('failed', { err });
    const out = lastOutput();
    expect(out.err.name).toBe('Error');
    expect(out.err.message).toBe('boom');
    expect(Array.isArray(out.err.stack)).toBe(true);
    expect(out.err.stack[0]).toContain('Error: boom');
  });

  test('non-Error objects in meta are left as-is', () => {
    logger.error('info', { code: 500, detail: 'not an error' });
    const out = lastOutput();
    expect(out.code).toBe(500);
    expect(out.detail).toBe('not an error');
  });
});
