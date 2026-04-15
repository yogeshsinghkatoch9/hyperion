import { describe, it, expect } from 'vitest';

const pm = require('../services/processManager');

// ── Format Bytes ──
describe('Format Bytes', () => {
  it('formats 0 bytes', () => {
    expect(pm.formatBytes(0)).toBe('0 B');
  });
  it('formats bytes', () => {
    expect(pm.formatBytes(512)).toBe('512.0 B');
  });
  it('formats KB', () => {
    expect(pm.formatBytes(1024)).toBe('1.0 KB');
  });
  it('formats MB', () => {
    expect(pm.formatBytes(1048576)).toBe('1.0 MB');
  });
  it('formats GB', () => {
    expect(pm.formatBytes(1073741824)).toBe('1.0 GB');
  });
  it('handles null', () => {
    expect(pm.formatBytes(null)).toBe('0 B');
  });
});

// ── Format Uptime ──
describe('Format Uptime', () => {
  it('formats minutes only', () => {
    expect(pm.formatUptime(300)).toBe('5m');
  });
  it('formats hours and minutes', () => {
    expect(pm.formatUptime(3660)).toBe('1h 1m');
  });
  it('formats days', () => {
    expect(pm.formatUptime(90000)).toBe('1d 1h 0m');
  });
  it('handles zero', () => {
    expect(pm.formatUptime(0)).toBe('0m');
  });
});

// ── Kill Process Guards ──
describe('Kill Process Guards', () => {
  it('rejects invalid PID', () => {
    expect(() => pm.killProcess(0)).toThrow('Invalid PID');
  });
  it('rejects negative PID', () => {
    expect(() => pm.killProcess(-5)).toThrow('Invalid PID');
  });
  it('rejects PID 1', () => {
    expect(() => pm.killProcess(1)).toThrow('Cannot kill');
  });
  it('rejects own PID', () => {
    expect(() => pm.killProcess(process.pid)).toThrow('Cannot kill');
  });
});

// ── Kill By Port Guards ──
describe('Kill By Port Guards', () => {
  it('rejects invalid port', () => {
    expect(() => pm.killByPort(0)).toThrow('Invalid port');
  });
  it('rejects port > 65535', () => {
    expect(() => pm.killByPort(99999)).toThrow('Invalid port');
  });
});

// ── Port Scan Guards ──
describe('Port Scan Guards', () => {
  it('rejects too large range', async () => {
    await expect(pm.scanPortRange('127.0.0.1', 1, 5000)).rejects.toThrow('too large');
  });
});

// ── System Resources ──
describe('System Resources', () => {
  it('returns resource object', () => {
    const r = pm.getSystemResources();
    expect(r).toHaveProperty('cpu');
    expect(r).toHaveProperty('memory');
    expect(r).toHaveProperty('uptime');
    expect(r).toHaveProperty('loadAvg');
    expect(r.cpu).toHaveProperty('cores');
    expect(r.memory).toHaveProperty('total');
    expect(r.memory).toHaveProperty('usedPercent');
  });
  it('cores is positive number', () => {
    expect(pm.getSystemResources().cpu.cores).toBeGreaterThan(0);
  });
});

// ── Scan Port ──
describe('Scan Port', () => {
  it('detects closed port', async () => {
    const result = await pm.scanPort('127.0.0.1', 1, 500);
    expect(result.status).toBe('closed');
    expect(result.port).toBe(1);
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'listProcesses', 'searchProcesses',
      'killProcess', 'killByPort',
      'getProcessOnPort', 'getListeningPorts', 'scanPort', 'scanPortRange',
      'getSystemResources', 'getTopProcesses', 'getProcessTree',
      'formatBytes', 'formatUptime',
    ];
    for (const fn of fns) {
      expect(typeof pm[fn]).toBe('function');
    }
  });
});
