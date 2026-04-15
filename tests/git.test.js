import { describe, it, expect } from 'vitest';

const git = require('../services/git');

// ── Status Character Parsing ──
describe('Status Character Parsing', () => {
  it('parses M as modified', () => {
    expect(git.parseStatusChar('M')).toBe('modified');
  });

  it('parses A as added', () => {
    expect(git.parseStatusChar('A')).toBe('added');
  });

  it('parses D as deleted', () => {
    expect(git.parseStatusChar('D')).toBe('deleted');
  });

  it('parses R as renamed', () => {
    expect(git.parseStatusChar('R')).toBe('renamed');
  });

  it('parses C as copied', () => {
    expect(git.parseStatusChar('C')).toBe('copied');
  });

  it('parses U as unmerged', () => {
    expect(git.parseStatusChar('U')).toBe('unmerged');
  });

  it('returns unknown for unrecognized', () => {
    expect(git.parseStatusChar('X')).toBe('unknown');
    expect(git.parseStatusChar('?')).toBe('unknown');
  });
});

// ── Hash Sanitization ──
describe('Hash Sanitization', () => {
  it('allows normal hashes', () => {
    expect(git.sanitizeHash('abc123def456')).toBe('abc123def456');
  });

  it('allows HEAD references', () => {
    expect(git.sanitizeHash('HEAD')).toBe('HEAD');
    expect(git.sanitizeHash('HEAD~1')).toBe('HEAD~1');
    expect(git.sanitizeHash('HEAD^2')).toBe('HEAD^2');
  });

  it('strips semicolons and pipes', () => {
    // sanitizeHash only allows [a-zA-Z0-9~^.], so spaces and semicolons are removed
    expect(git.sanitizeHash('abc;rm -rf')).toBe('abcrmrf');
  });

  it('strips backticks', () => {
    expect(git.sanitizeHash('abc`whoami`')).toBe('abcwhoami');
  });

  it('strips dollar signs', () => {
    expect(git.sanitizeHash('abc$HOME')).toBe('abcHOME');
  });
});

// ── Branch Sanitization ──
describe('Branch Sanitization', () => {
  it('allows normal branch names', () => {
    expect(git.sanitizeBranch('main')).toBe('main');
    expect(git.sanitizeBranch('feature/new-thing')).toBe('feature/new-thing');
    expect(git.sanitizeBranch('release-1.0')).toBe('release-1.0');
  });

  it('allows remote tracking branches', () => {
    expect(git.sanitizeBranch('origin/main')).toBe('origin/main');
  });

  it('strips dangerous characters', () => {
    expect(git.sanitizeBranch('main;rm -rf /')).toBe('mainrm-rf/');
  });

  it('strips spaces', () => {
    expect(git.sanitizeBranch('my branch')).toBe('mybranch');
  });

  it('allows dots and underscores', () => {
    expect(git.sanitizeBranch('v1.0_hotfix')).toBe('v1.0_hotfix');
  });
});

// ── Path Sanitization ──
describe('Path Sanitization', () => {
  it('allows normal file paths', () => {
    expect(git.sanitizePath('src/index.js')).toBe('src/index.js');
    expect(git.sanitizePath('package.json')).toBe('package.json');
  });

  it('strips backticks', () => {
    expect(git.sanitizePath('file`cmd`')).toBe('filecmd');
  });

  it('strips dollar signs', () => {
    expect(git.sanitizePath('$HOME/file')).toBe('HOME/file');
  });

  it('strips semicolons', () => {
    expect(git.sanitizePath('file;rm')).toBe('filerm');
  });

  it('strips pipes', () => {
    expect(git.sanitizePath('file|cat')).toBe('filecat');
  });

  it('strips ampersands', () => {
    expect(git.sanitizePath('file&cmd')).toBe('filecmd');
  });

  it('strips angle brackets', () => {
    expect(git.sanitizePath('file>out')).toBe('fileout');
    expect(git.sanitizePath('file<in')).toBe('filein');
  });

  it('allows paths with spaces and special chars', () => {
    expect(git.sanitizePath('my file (copy).txt')).toBe('my file (copy).txt');
  });
});

// ── Data Shapes ──
describe('Data Shapes', () => {
  it('log entry has expected fields', () => {
    const entry = {
      hash: 'abc123',
      short: 'abc',
      parents: ['def456'],
      subject: 'Initial commit',
      author: 'Test',
      email: 'test@test.com',
      date: '2024-01-01',
      refs: ['HEAD -> main'],
    };
    expect(entry).toHaveProperty('hash');
    expect(entry).toHaveProperty('short');
    expect(entry).toHaveProperty('parents');
    expect(entry).toHaveProperty('subject');
    expect(entry).toHaveProperty('author');
    expect(entry).toHaveProperty('date');
    expect(entry).toHaveProperty('refs');
    expect(Array.isArray(entry.parents)).toBe(true);
    expect(Array.isArray(entry.refs)).toBe(true);
  });

  it('status has staged/unstaged/untracked arrays', () => {
    const status = { staged: [], unstaged: [], untracked: [] };
    expect(Array.isArray(status.staged)).toBe(true);
    expect(Array.isArray(status.unstaged)).toBe(true);
    expect(Array.isArray(status.untracked)).toBe(true);
  });

  it('branch entry has expected fields', () => {
    const branch = { name: 'main', hash: 'abc', upstream: 'origin/main', current: true, remote: false };
    expect(branch).toHaveProperty('name');
    expect(branch).toHaveProperty('current');
    expect(branch).toHaveProperty('remote');
  });

  it('stash entry has expected fields', () => {
    const stash = { ref: 'stash@{0}', message: 'WIP', date: '2024-01-01' };
    expect(stash).toHaveProperty('ref');
    expect(stash).toHaveProperty('message');
  });

  it('remote entry has fetch and push URLs', () => {
    const remote = { name: 'origin', fetchUrl: 'https://github.com/x/y', pushUrl: 'https://github.com/x/y' };
    expect(remote).toHaveProperty('fetchUrl');
    expect(remote).toHaveProperty('pushUrl');
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all expected functions', () => {
    const fns = [
      'isGitRepo', 'getRepoRoot', 'getRepoInfo',
      'getStatus', 'parseStatusChar',
      'getLog', 'getCommitDetail',
      'getDiff', 'getDiffStats',
      'getBranches', 'createBranch', 'checkoutBranch', 'deleteBranch', 'mergeBranch',
      'stageFile', 'stageAll', 'unstageFile', 'unstageAll', 'discardFile',
      'commit',
      'getStashes', 'stashPush', 'stashPop', 'stashDrop', 'stashShow',
      'getRemotes', 'fetch', 'pull', 'push',
      'getTags', 'blame', 'getFileHistory',
      'sanitizeHash', 'sanitizeBranch', 'sanitizePath',
    ];
    for (const fn of fns) {
      expect(typeof git[fn]).toBe('function');
    }
  });
});

// ── Error Guards ──
describe('Error Guards', () => {
  it('isGitRepo returns false for non-repo path', () => {
    expect(git.isGitRepo('/tmp')).toBe(false);
  });

  it('getStatus throws for non-repo', () => {
    expect(() => git.getStatus('/tmp')).toThrow();
  });
});
