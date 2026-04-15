import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const env = require('../services/envManager');

// Helper: create temp env file
function createTempEnv(content) {
  const dir = mkdtempSync(join(tmpdir(), 'hyperion-env-'));
  const filePath = join(dir, '.env');
  writeFileSync(filePath, content);
  return filePath;
}

// ── Parse Env String ──
describe('Parse Env String', () => {
  it('parses key=value', () => {
    const entries = env.parseEnvString('FOO=bar');
    expect(entries[0].type).toBe('variable');
    expect(entries[0].key).toBe('FOO');
    expect(entries[0].value).toBe('bar');
  });
  it('parses quoted values', () => {
    const entries = env.parseEnvString('FOO="hello world"');
    expect(entries[0].value).toBe('hello world');
  });
  it('parses single-quoted values', () => {
    const entries = env.parseEnvString("FOO='hello'");
    expect(entries[0].value).toBe('hello');
  });
  it('parses comments', () => {
    const entries = env.parseEnvString('# comment');
    expect(entries[0].type).toBe('comment');
  });
  it('parses blank lines', () => {
    const entries = env.parseEnvString('');
    expect(entries[0].type).toBe('blank');
  });
  it('detects invalid lines', () => {
    const entries = env.parseEnvString('no-equals-sign');
    expect(entries[0].type).toBe('invalid');
  });
  it('handles empty value', () => {
    const entries = env.parseEnvString('EMPTY=');
    expect(entries[0].value).toBe('');
  });
});

// ── Sensitive Key Detection ──
describe('Sensitive Key Detection', () => {
  it('detects PASSWORD', () => {
    expect(env.isSensitiveKey('DB_PASSWORD')).toBe(true);
  });
  it('detects SECRET', () => {
    expect(env.isSensitiveKey('JWT_SECRET')).toBe(true);
  });
  it('detects API_KEY', () => {
    expect(env.isSensitiveKey('API_KEY')).toBe(true);
  });
  it('detects TOKEN', () => {
    expect(env.isSensitiveKey('AUTH_TOKEN')).toBe(true);
  });
  it('allows non-sensitive', () => {
    expect(env.isSensitiveKey('APP_NAME')).toBe(false);
  });
  it('allows PORT', () => {
    expect(env.isSensitiveKey('PORT')).toBe(false);
  });
});

// ── Mask Value ──
describe('Mask Value', () => {
  it('masks long value', () => {
    const masked = env.maskValue('supersecretvalue');
    expect(masked.startsWith('su')).toBe(true);
    expect(masked.endsWith('ue')).toBe(true);
    expect(masked).toContain('*');
  });
  it('masks short value', () => {
    expect(env.maskValue('ab')).toBe('****');
  });
  it('masks null', () => {
    expect(env.maskValue(null)).toBe('****');
  });
});

// ── Read/Write Env File ──
describe('Read/Write Env File', () => {
  it('reads env file', () => {
    const f = createTempEnv('FOO=bar\nBAZ=qux');
    const entries = env.readEnvFile(f, false);
    expect(entries.filter(e => e.type === 'variable')).toHaveLength(2);
    unlinkSync(f);
  });
  it('masks sensitive values', () => {
    const f = createTempEnv('DB_PASSWORD=secret123');
    const entries = env.readEnvFile(f, true);
    const pwd = entries.find(e => e.key === 'DB_PASSWORD');
    expect(pwd.displayValue).toContain('*');
    expect(pwd.displayValue).not.toBe('secret123');
    unlinkSync(f);
  });
  it('throws on missing file', () => {
    expect(() => env.readEnvFile('/nonexistent/.env')).toThrow('not found');
  });
});

// ── Set / Remove Variable ──
describe('Set / Remove Variable', () => {
  it('sets new variable', () => {
    const f = createTempEnv('FOO=bar');
    env.setVariable(f, 'NEW_VAR', 'value');
    const content = readFileSync(f, 'utf8');
    expect(content).toContain('NEW_VAR=value');
    unlinkSync(f);
  });
  it('updates existing variable', () => {
    const f = createTempEnv('FOO=bar');
    env.setVariable(f, 'FOO', 'updated');
    const content = readFileSync(f, 'utf8');
    expect(content).toContain('FOO=updated');
    expect(content).not.toContain('FOO=bar');
    unlinkSync(f);
  });
  it('removes variable', () => {
    const f = createTempEnv('FOO=bar\nBAZ=qux');
    env.removeVariable(f, 'FOO');
    const content = readFileSync(f, 'utf8');
    expect(content).not.toContain('FOO');
    expect(content).toContain('BAZ=qux');
    unlinkSync(f);
  });
  it('throws removing nonexistent variable', () => {
    const f = createTempEnv('FOO=bar');
    expect(() => env.removeVariable(f, 'NOPE')).toThrow('not found');
    unlinkSync(f);
  });
});

// ── Compare Env Files ──
describe('Compare Env Files', () => {
  it('detects same values', () => {
    const f1 = createTempEnv('A=1');
    const f2 = createTempEnv('A=1');
    const result = env.compareEnvFiles(f1, f2);
    expect(result.stats.same).toBe(1);
    unlinkSync(f1); unlinkSync(f2);
  });
  it('detects different values', () => {
    const f1 = createTempEnv('A=1');
    const f2 = createTempEnv('A=2');
    const result = env.compareEnvFiles(f1, f2);
    expect(result.stats.different).toBe(1);
    unlinkSync(f1); unlinkSync(f2);
  });
  it('detects only-in-first', () => {
    const f1 = createTempEnv('A=1\nB=2');
    const f2 = createTempEnv('A=1');
    const result = env.compareEnvFiles(f1, f2);
    expect(result.stats.onlyFirst).toBe(1);
    unlinkSync(f1); unlinkSync(f2);
  });
  it('detects only-in-second', () => {
    const f1 = createTempEnv('A=1');
    const f2 = createTempEnv('A=1\nC=3');
    const result = env.compareEnvFiles(f1, f2);
    expect(result.stats.onlySecond).toBe(1);
    unlinkSync(f1); unlinkSync(f2);
  });
});

// ── Validate ──
describe('Validate', () => {
  it('validates clean env file', () => {
    const f = createTempEnv('FOO=bar\nBAZ=123');
    const r = env.validateEnvFile(f);
    expect(r.valid).toBe(true);
    expect(r.entryCount).toBe(2);
    unlinkSync(f);
  });
  it('detects duplicates', () => {
    const f = createTempEnv('FOO=1\nFOO=2');
    const r = env.validateEnvFile(f);
    expect(r.issues.some(i => i.message.includes('Duplicate'))).toBe(true);
    unlinkSync(f);
  });
});

// ── Generate Template ──
describe('Generate Template', () => {
  it('strips sensitive values', () => {
    const entries = env.parseEnvString('APP_NAME=myapp\nDB_PASSWORD=secret');
    const template = env.generateTemplate(entries);
    expect(template).toContain('APP_NAME=myapp');
    expect(template).toContain('DB_PASSWORD=');
    expect(template).not.toContain('secret');
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all functions', () => {
    const fns = [
      'parseEnvFile', 'parseEnvString',
      'isSensitiveKey', 'maskValue',
      'readEnvFile', 'writeEnvFile',
      'setVariable', 'removeVariable',
      'compareEnvFiles', 'mergeEnvFiles',
      'validateEnvFile', 'discoverEnvFiles', 'generateTemplate',
    ];
    for (const fn of fns) {
      expect(typeof env[fn]).toBe('function');
    }
  });
});
