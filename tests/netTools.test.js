import { describe, it, expect } from 'vitest';

const net = require('../services/netTools');

// ── Hostname Sanitization ──
describe('Hostname Sanitization', () => {
  it('allows valid hostname', () => {
    expect(net.sanitizeHostname('example.com')).toBe('example.com');
  });
  it('allows IP address', () => {
    expect(net.sanitizeHostname('192.168.1.1')).toBe('192.168.1.1');
  });
  it('strips special chars', () => {
    expect(net.sanitizeHostname('host;rm')).toBe('hostrm');
  });
  it('allows hyphens', () => {
    expect(net.sanitizeHostname('my-host.com')).toBe('my-host.com');
  });
  it('truncates long hostnames', () => {
    const long = 'a'.repeat(300);
    expect(net.sanitizeHostname(long).length).toBe(253);
  });
});

// ── Hostname Validation ──
describe('Hostname Validation', () => {
  it('validates domain', () => {
    expect(net.isValidHostname('example.com')).toBe(true);
  });
  it('validates IP', () => {
    expect(net.isValidHostname('192.168.1.1')).toBe(true);
  });
  it('rejects empty', () => {
    expect(net.isValidHostname('')).toBe(false);
  });
  it('rejects spaces', () => {
    expect(net.isValidHostname('bad host')).toBe(false);
  });
});

// ── Common Ports ──
describe('Common Ports', () => {
  it('knows HTTP', () => {
    expect(net.getPortInfo(80)).toBe('HTTP');
  });
  it('knows HTTPS', () => {
    expect(net.getPortInfo(443)).toBe('HTTPS');
  });
  it('knows SSH', () => {
    expect(net.getPortInfo(22)).toBe('SSH');
  });
  it('knows MySQL', () => {
    expect(net.getPortInfo(3306)).toBe('MySQL');
  });
  it('knows Redis', () => {
    expect(net.getPortInfo(6379)).toBe('Redis');
  });
  it('returns Unknown for unknown', () => {
    expect(net.getPortInfo(12345)).toBe('Unknown');
  });
});

// ── Port Check ──
describe('Port Check', () => {
  it('detects closed port', async () => {
    const result = await net.checkPort('127.0.0.1', 1, 500);
    expect(result.open).toBe(false);
  });
  it('returns host and port in result', async () => {
    const result = await net.checkPort('127.0.0.1', 1, 500);
    expect(result.host).toBe('127.0.0.1');
    expect(result.port).toBe(1);
  });
});

// ── DNS Lookup ──
describe('DNS Lookup', () => {
  it('returns record types', async () => {
    const result = await net.dnsLookup('google.com');
    expect(result).toHaveProperty('A');
    expect(result).toHaveProperty('AAAA');
    expect(result).toHaveProperty('MX');
    expect(result).toHaveProperty('NS');
    expect(result).toHaveProperty('TXT');
  }, 15000);
});

// ── COMMON_PORTS constant ──
describe('COMMON_PORTS', () => {
  it('has entries', () => {
    expect(Object.keys(net.COMMON_PORTS).length).toBeGreaterThan(10);
  });
  it('all values are strings', () => {
    Object.values(net.COMMON_PORTS).forEach(v => expect(typeof v).toBe('string'));
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'sanitizeHostname', 'isValidHostname',
      'dnsLookup', 'reverseDns',
      'ping', 'traceroute', 'whois',
      'checkSslCert', 'getHttpHeaders', 'checkPort',
      'getPortInfo',
    ];
    for (const fn of fns) {
      expect(typeof net[fn]).toBe('function');
    }
  });
});
