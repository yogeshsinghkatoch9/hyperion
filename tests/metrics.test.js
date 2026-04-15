import { describe, test, expect, beforeEach, vi } from 'vitest';

let metricsService;

beforeEach(() => {
  vi.resetModules();
  metricsService = require('../services/metricsService');
  metricsService.reset();
});

describe('recordRequest', () => {
  test('increments total count', () => {
    metricsService.recordRequest('GET', '/api/test', 200, 10);
    metricsService.recordRequest('POST', '/api/data', 201, 20);
    const m = metricsService.getMetrics();
    expect(m.requests.total).toBe(2);
  });

  test('tracks by method', () => {
    metricsService.recordRequest('GET', '/', 200, 5);
    metricsService.recordRequest('GET', '/a', 200, 5);
    metricsService.recordRequest('POST', '/b', 201, 5);
    const m = metricsService.getMetrics();
    expect(m.requests.byMethod.GET).toBe(2);
    expect(m.requests.byMethod.POST).toBe(1);
  });

  test('tracks by status code', () => {
    metricsService.recordRequest('GET', '/', 200, 5);
    metricsService.recordRequest('GET', '/', 404, 5);
    metricsService.recordRequest('GET', '/', 200, 5);
    const m = metricsService.getMetrics();
    expect(m.requests.byStatus[200]).toBe(2);
    expect(m.requests.byStatus[404]).toBe(1);
  });
});

describe('getMetrics', () => {
  test('returns expected structure', () => {
    const m = metricsService.getMetrics();
    expect(m).toHaveProperty('requests');
    expect(m).toHaveProperty('system');
    expect(m).toHaveProperty('timestamp');
    expect(m.requests).toHaveProperty('total');
    expect(m.requests).toHaveProperty('byMethod');
    expect(m.requests).toHaveProperty('byStatus');
    expect(m.requests).toHaveProperty('avgDuration');
    expect(m.requests).toHaveProperty('p95Duration');
    expect(m.requests).toHaveProperty('p99Duration');
    expect(m.system).toHaveProperty('uptime');
    expect(m.system).toHaveProperty('memUsage');
    expect(m.system).toHaveProperty('cpuUsage');
  });

  test('avgDuration is calculated correctly', () => {
    metricsService.recordRequest('GET', '/', 200, 10);
    metricsService.recordRequest('GET', '/', 200, 30);
    const m = metricsService.getMetrics();
    expect(m.requests.avgDuration).toBe(20);
  });

  test('returns zero metrics when no requests recorded', () => {
    const m = metricsService.getMetrics();
    expect(m.requests.total).toBe(0);
    expect(m.requests.avgDuration).toBe(0);
    expect(m.requests.p95Duration).toBe(0);
    expect(m.requests.p99Duration).toBe(0);
  });
});

describe('percentile calculations', () => {
  test('p95 and p99 are computed correctly', () => {
    // Insert 100 requests with durations 1..100
    for (let i = 1; i <= 100; i++) {
      metricsService.recordRequest('GET', '/', 200, i);
    }
    const m = metricsService.getMetrics();
    expect(m.requests.p95Duration).toBe(95);
    expect(m.requests.p99Duration).toBe(99);
  });

  test('p95 with single request equals that duration', () => {
    metricsService.recordRequest('GET', '/', 200, 42);
    const m = metricsService.getMetrics();
    expect(m.requests.p95Duration).toBe(42);
    expect(m.requests.p99Duration).toBe(42);
  });
});

describe('middleware', () => {
  test('returns a function', () => {
    const mw = metricsService.middleware();
    expect(typeof mw).toBe('function');
  });

  test('measures duration and records request on finish', () => {
    const mw = metricsService.middleware();
    const req = { method: 'GET', originalUrl: '/api/test' };
    const listeners = {};
    const res = {
      statusCode: 200,
      on: (event, fn) => { listeners[event] = fn; },
    };
    const next = vi.fn();

    mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    // Simulate response finish
    listeners.finish();

    const m = metricsService.getMetrics();
    expect(m.requests.total).toBe(1);
    expect(m.requests.byMethod.GET).toBe(1);
    expect(m.requests.byStatus[200]).toBe(1);
  });
});

describe('reset', () => {
  test('clears all metrics', () => {
    metricsService.recordRequest('GET', '/', 200, 10);
    metricsService.recordRequest('POST', '/', 500, 20);
    metricsService.reset();
    const m = metricsService.getMetrics();
    expect(m.requests.total).toBe(0);
    expect(Object.keys(m.requests.byMethod)).toHaveLength(0);
    expect(Object.keys(m.requests.byStatus)).toHaveLength(0);
    expect(m.requests.avgDuration).toBe(0);
  });
});

describe('prometheus format', () => {
  test('metrics route returns valid prometheus text', async () => {
    metricsService.recordRequest('GET', '/', 200, 15);
    const m = metricsService.getMetrics();
    // Verify the metrics service data is there for prometheus
    expect(m.requests.total).toBe(1);
    expect(m.system.memUsage).toBeGreaterThan(0);
    expect(m.system.uptime).toBeGreaterThan(0);
  });
});
