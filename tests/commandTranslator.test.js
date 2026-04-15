import { describe, it, expect, vi } from 'vitest';

// Mock dependencies before requiring module
vi.mock('child_process', () => ({
  execSync: vi.fn(() => '0, 0, 1920, 1080'),
}));
vi.mock('fs', () => ({
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => ''),
  existsSync: vi.fn(() => false),
  mkdirSync: vi.fn(),
}));
vi.mock('os', () => ({
  homedir: () => '/mock/home',
}));

const { translate, QUICK_ACTIONS, PATTERNS } = require('../services/commandTranslator');

// ── Direct command passthrough ──
describe('translate — direct passthrough', () => {
  it('passes through commands starting with $', () => {
    const r = translate('$ls -la');
    expect(r.command).toBe('ls -la');
    expect(r.confidence).toBe(1);
  });
  it('passes through commands starting with !', () => {
    const r = translate('!echo hello');
    expect(r.command).toBe('echo hello');
    expect(r.confidence).toBe(1);
  });
  it('returns null command for empty input', () => {
    const r = translate('');
    expect(r).toBeNull();
  });
});

// ── Raw shell command detection ──
describe('translate — raw shell commands', () => {
  it('recognizes "ls" as a raw command', () => {
    const r = translate('ls -la /tmp');
    expect(r.command).toBe('ls -la /tmp');
    expect(r.confidence).toBe(1);
  });
  it('recognizes "git status" as a raw command', () => {
    const r = translate('git status');
    expect(r.command).toContain('git status');
  });
  it('recognizes "docker ps" as a raw command', () => {
    const r = translate('docker ps -a');
    expect(r.command).toBe('docker ps -a');
  });
});

// ── Natural language: app operations ──
describe('translate — app commands', () => {
  it('translates "open chrome"', () => {
    const r = translate('open chrome');
    expect(r.command).toContain('open -a');
    expect(r.command).toContain('Google Chrome');
    expect(r.confidence).toBe(0.9);
  });
  it('translates "is slack running?"', () => {
    const r = translate('is slack running?');
    expect(r.command).toContain('pgrep');
    expect(r.command).toContain('Slack');
  });
  it('translates "restart firefox"', () => {
    const r = translate('restart firefox');
    expect(r.command).toContain('Firefox');
  });
  it('translates "force quit chrome"', () => {
    const r = translate('force quit chrome');
    expect(r.command).toContain('pkill -9');
    expect(r.command).toContain('Google Chrome');
  });
});

// ── Natural language: system controls ──
describe('translate — system controls', () => {
  it('translates "turn on dark mode"', () => {
    const r = translate('turn on dark mode');
    expect(r.command).toContain('dark mode');
  });
  it('translates "set volume to 75"', () => {
    const r = translate('set volume to 75');
    expect(r.command).toContain('75');
  });
  it('translates "mute"', () => {
    const r = translate('mute');
    expect(r.command).toContain('muted');
  });
  it('translates "lock my screen"', () => {
    const r = translate('lock my screen');
    expect(r.command).toContain('displaysleepnow');
  });
});

// ── Natural language: files ──
describe('translate — file commands', () => {
  it('translates "find big files"', () => {
    const r = translate('find big files');
    expect(r.command).toContain('find');
    expect(r.command).toContain('100M');
  });
  it('translates "show downloads"', () => {
    const r = translate('show downloads');
    expect(r.command).toContain('ls');
    expect(r.command).toContain('Downloads');
  });
  it('translates "create folder called test"', () => {
    const r = translate('create folder called test');
    expect(r.command).toContain('mkdir');
    expect(r.command).toContain('test');
  });
});

// ── Natural language: utilities ──
describe('translate — utilities', () => {
  it('translates "generate password"', () => {
    const r = translate('generate password');
    expect(r.command).toContain('openssl');
  });
  it('translates "my ip"', () => {
    const r = translate('my ip');
    expect(r.command).toContain('ifconfig.me');
  });
  it('translates "empty trash"', () => {
    const r = translate('empty trash');
    expect(r.command).toContain('trash');
  });
  it('translates "take screenshot"', () => {
    const r = translate('take screenshot');
    expect(r.command).toContain('screencapture');
  });
  it('translates "what\'s the weather"', () => {
    const r = translate("what's the weather");
    expect(r.command).toContain('wttr.in');
  });
});

// ── Fallback: unrecognized input ──
describe('translate — fallback', () => {
  it('returns null command for unrecognized input', () => {
    const r = translate('do something magical and weird');
    expect(r.command).toBeNull();
    expect(r.confidence).toBe(0);
  });
  it('provides suggestions array on fallback', () => {
    const r = translate('something about files');
    expect(r.suggestions).toBeDefined();
    expect(Array.isArray(r.suggestions)).toBe(true);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });
});

// ── QUICK_ACTIONS ──
describe('QUICK_ACTIONS', () => {
  it('has multiple categories', () => {
    expect(QUICK_ACTIONS.length).toBeGreaterThanOrEqual(5);
  });
  it('each category has actions array', () => {
    for (const cat of QUICK_ACTIONS) {
      expect(cat).toHaveProperty('category');
      expect(Array.isArray(cat.actions)).toBe(true);
      for (const a of cat.actions) {
        expect(a).toHaveProperty('label');
        expect(a).toHaveProperty('query');
      }
    }
  });
});

// ── PATTERNS ──
describe('PATTERNS', () => {
  it('has 30+ patterns', () => {
    expect(PATTERNS.length).toBeGreaterThan(30);
  });
  it('each pattern has match regex, build function, and desc', () => {
    for (const p of PATTERNS) {
      expect(p.match).toBeInstanceOf(RegExp);
      expect(typeof p.build).toBe('function');
      expect(typeof p.desc).toBe('string');
    }
  });
});

// ── Module exports ──
describe('Module exports', () => {
  it('exports translate, QUICK_ACTIONS, PATTERNS', () => {
    expect(typeof translate).toBe('function');
    expect(Array.isArray(QUICK_ACTIONS)).toBe(true);
    expect(Array.isArray(PATTERNS)).toBe(true);
  });
});
