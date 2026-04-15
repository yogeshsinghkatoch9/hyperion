import { describe, it, expect } from 'vitest';

const dep = require('../services/depAuditor');

// ── Package.json Parsing ──
describe('Package.json Parsing', () => {
  it('parses project package.json', () => {
    const result = dep.parsePackageJson(__dirname + '/..');
    expect(result.name).toBeDefined();
    expect(result.deps).toBeInstanceOf(Array);
    expect(result.devDeps).toBeInstanceOf(Array);
  });
  it('includes total count', () => {
    const result = dep.parsePackageJson(__dirname + '/..');
    expect(result.total).toBe(result.deps.length + result.devDeps.length);
  });
  it('has production deps', () => {
    const result = dep.parsePackageJson(__dirname + '/..');
    expect(result.deps.length).toBeGreaterThan(0);
    expect(result.deps[0].type).toBe('production');
  });
  it('throws for missing package.json', () => {
    expect(() => dep.parsePackageJson('/tmp/nonexistent')).toThrow('not found');
  });
});

// ── Severity Counting ──
describe('Severity Counting', () => {
  it('counts from metadata', () => {
    const audit = { metadata: { vulnerabilities: { critical: 1, high: 2, moderate: 3, low: 0, info: 0, total: 6 } } };
    const counts = dep.countSeverities(audit);
    expect(counts.critical).toBe(1);
    expect(counts.high).toBe(2);
    expect(counts.total).toBe(6);
  });
  it('counts from vulnerabilities object', () => {
    const audit = { vulnerabilities: { pkg1: { severity: 'high' }, pkg2: { severity: 'low' } } };
    const counts = dep.countSeverities(audit);
    expect(counts.high).toBe(1);
    expect(counts.low).toBe(1);
    expect(counts.total).toBe(2);
  });
  it('handles empty audit', () => {
    const counts = dep.countSeverities({});
    expect(counts.total).toBe(0);
  });
  it('handles null', () => {
    const counts = dep.countSeverities(null);
    expect(counts.total).toBe(0);
  });
});

// ── Security Score ──
describe('Security Score', () => {
  it('returns 100 for no vulnerabilities', () => {
    expect(dep.calculateSecurityScore({ critical: 0, high: 0, moderate: 0, low: 0, info: 0 })).toBe(100);
  });
  it('deducts for critical', () => {
    expect(dep.calculateSecurityScore({ critical: 1, high: 0, moderate: 0, low: 0, info: 0 })).toBe(75);
  });
  it('deducts for high', () => {
    expect(dep.calculateSecurityScore({ critical: 0, high: 1, moderate: 0, low: 0, info: 0 })).toBe(85);
  });
  it('clamps to 0', () => {
    expect(dep.calculateSecurityScore({ critical: 10, high: 10, moderate: 10, low: 10, info: 10 })).toBe(0);
  });
});

// ── Version Comparison ──
describe('Version Comparison', () => {
  it('detects major update', () => {
    expect(dep.isMajorUpdate('1.0.0', '2.0.0')).toBe(true);
  });
  it('detects minor update', () => {
    expect(dep.isMinorUpdate('1.0.0', '1.1.0')).toBe(true);
  });
  it('detects patch update', () => {
    expect(dep.isPatchUpdate('1.0.0', '1.0.1')).toBe(true);
  });
  it('compares versions correctly', () => {
    expect(dep.compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(dep.compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(dep.compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
});

// ── License Extraction ──
describe('License Extraction', () => {
  it('returns array', () => {
    const result = dep.extractLicenses(__dirname + '/..');
    expect(Array.isArray(result)).toBe(true);
  });
  it('has name and license fields', () => {
    const result = dep.extractLicenses(__dirname + '/..');
    if (result.length > 0) {
      expect(result[0].name).toBeDefined();
      expect(result[0].license).toBeDefined();
    }
  });
  it('returns empty for nonexistent dir', () => {
    const result = dep.extractLicenses('/tmp/nonexistent');
    expect(result).toEqual([]);
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'parsePackageJson', 'runAudit', 'countSeverities', 'calculateSecurityScore',
      'runOutdated', 'extractLicenses', 'parseVersion', 'compareVersions',
      'isMajorUpdate', 'isMinorUpdate', 'isPatchUpdate',
    ];
    for (const fn of fns) {
      expect(typeof dep[fn]).toBe('function');
    }
  });
});
