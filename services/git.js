/**
 * Hyperion Git Client — Full Git CLI Wrapper
 * Branches, commits, diffs, staging, stash, remotes, blame, tags
 */
const { execSync } = require('child_process');
const path = require('path');

// ── Helpers ──

function gitExec(args, cwd, timeout = 15000) {
  if (!cwd) throw new Error('Repository path required');
  try {
    return execSync(`git ${args}`, {
      encoding: 'utf8',
      timeout,
      cwd,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (err) {
    const msg = err.stderr ? err.stderr.trim() : err.message;
    throw new Error(msg || 'Git command failed');
  }
}

function isGitRepo(cwd) {
  try {
    gitExec('rev-parse --is-inside-work-tree', cwd, 5000);
    return true;
  } catch {
    return false;
  }
}

function getRepoRoot(cwd) {
  return gitExec('rev-parse --show-toplevel', cwd);
}

function getRepoInfo(cwd) {
  const root = getRepoRoot(cwd);
  let branch = '';
  try { branch = gitExec('rev-parse --abbrev-ref HEAD', cwd); } catch {}

  let upstream = '';
  try { upstream = gitExec('rev-parse --abbrev-ref @{u}', cwd); } catch {}

  let ahead = 0, behind = 0;
  try {
    const counts = gitExec('rev-list --left-right --count HEAD...@{u}', cwd);
    const [a, b] = counts.split('\t').map(Number);
    ahead = a || 0;
    behind = b || 0;
  } catch {}

  let lastCommit = null;
  try {
    const raw = gitExec('log -1 --format="%H|%h|%s|%an|%ae|%ai"', cwd);
    const [hash, short, subject, author, email, date] = raw.split('|');
    lastCommit = { hash, short, subject, author, email, date };
  } catch {}

  return { root, branch, upstream, ahead, behind, lastCommit };
}

// ═══ STATUS ═══

function getStatus(cwd) {
  const raw = gitExec('status --porcelain=v1 -uall', cwd);
  if (!raw) return { staged: [], unstaged: [], untracked: [] };

  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (const line of raw.split('\n')) {
    if (!line) continue;
    const x = line[0]; // index status
    const y = line[1]; // worktree status
    const file = line.slice(3);

    if (x === '?' && y === '?') {
      untracked.push({ file, status: 'untracked' });
    } else {
      if (x !== ' ' && x !== '?') {
        staged.push({ file, status: parseStatusChar(x) });
      }
      if (y !== ' ' && y !== '?') {
        unstaged.push({ file, status: parseStatusChar(y) });
      }
    }
  }

  return { staged, unstaged, untracked };
}

function parseStatusChar(c) {
  const map = { M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'copied', U: 'unmerged' };
  return map[c] || 'unknown';
}

// ═══ LOG ═══

function getLog(cwd, { limit = 50, skip = 0, branch, author, search, file } = {}) {
  let args = `log --format="%H|%h|%P|%s|%an|%ae|%ai|%D" --no-color`;
  args += ` -n ${Math.min(Math.max(1, parseInt(limit) || 50), 500)}`;
  if (skip > 0) args += ` --skip=${parseInt(skip)}`;
  if (branch) args += ` ${sanitizeBranch(branch)}`;
  if (author) args += ` --author="${author.replace(/"/g, '')}"`;
  if (search) args += ` --grep="${search.replace(/"/g, '')}"`;
  if (file) args += ` -- "${sanitizePath(file)}"`;

  const raw = gitExec(args, cwd);
  if (!raw) return [];

  return raw.split('\n').filter(Boolean).map(line => {
    const parts = line.split('|');
    if (parts.length < 8) return null;
    return {
      hash: parts[0],
      short: parts[1],
      parents: parts[2] ? parts[2].split(' ') : [],
      subject: parts[3],
      author: parts[4],
      email: parts[5],
      date: parts[6],
      refs: parts[7] ? parts[7].split(',').map(r => r.trim()).filter(Boolean) : [],
    };
  }).filter(Boolean);
}

function getCommitDetail(cwd, hash) {
  const safe = sanitizeHash(hash);
  const raw = gitExec(`show --stat --format="%H|%h|%P|%s|%b|%an|%ae|%ai|%cn|%ce|%ci" ${safe}`, cwd);
  const lines = raw.split('\n');
  const firstLine = lines[0];
  const parts = firstLine.split('|');

  // Parse stat lines (after the empty line separator)
  const statLines = [];
  let inStats = false;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === '') { inStats = true; continue; }
    if (inStats && l.match(/^\s*\d+ files? changed/)) {
      statLines.push(l.trim());
      break;
    }
    if (inStats && l.trim()) {
      statLines.push(l.trim());
    }
  }

  return {
    hash: parts[0],
    short: parts[1],
    parents: parts[2] ? parts[2].split(' ') : [],
    subject: parts[3],
    body: parts[4] || '',
    author: parts[5],
    authorEmail: parts[6],
    authorDate: parts[7],
    committer: parts[8],
    committerEmail: parts[9],
    committerDate: parts[10],
    stats: statLines,
  };
}

// ═══ DIFF ═══

function getDiff(cwd, { staged = false, file, commit, commit2 } = {}) {
  let args = 'diff --no-color';
  if (staged) args += ' --cached';
  if (commit && commit2) {
    args = `diff --no-color ${sanitizeHash(commit)} ${sanitizeHash(commit2)}`;
  } else if (commit) {
    args = `diff --no-color ${sanitizeHash(commit)}~ ${sanitizeHash(commit)}`;
  }
  if (file) args += ` -- "${sanitizePath(file)}"`;

  return gitExec(args, cwd, 30000);
}

function getDiffStats(cwd, { staged = false, commit } = {}) {
  let args = 'diff --stat --no-color';
  if (staged) args += ' --cached';
  if (commit) args = `diff --stat --no-color ${sanitizeHash(commit)}~ ${sanitizeHash(commit)}`;

  return gitExec(args, cwd);
}

// ═══ BRANCHES ═══

function getBranches(cwd) {
  const raw = gitExec('branch -a --format="%(refname:short)|%(objectname:short)|%(upstream:short)|%(HEAD)"', cwd);
  if (!raw) return [];

  return raw.split('\n').filter(Boolean).map(line => {
    const [name, hash, upstream, head] = line.split('|');
    return {
      name,
      hash,
      upstream: upstream || '',
      current: head === '*',
      remote: name.startsWith('remotes/') || name.startsWith('origin/'),
    };
  });
}

function createBranch(cwd, name, startPoint) {
  const safeName = sanitizeBranch(name);
  let args = `branch ${safeName}`;
  if (startPoint) args += ` ${sanitizeHash(startPoint)}`;
  gitExec(args, cwd);
  return true;
}

function checkoutBranch(cwd, name) {
  gitExec(`checkout ${sanitizeBranch(name)}`, cwd);
  return true;
}

function deleteBranch(cwd, name, force = false) {
  const flag = force ? '-D' : '-d';
  gitExec(`branch ${flag} ${sanitizeBranch(name)}`, cwd);
  return true;
}

function mergeBranch(cwd, name) {
  return gitExec(`merge ${sanitizeBranch(name)}`, cwd, 30000);
}

// ═══ STAGING ═══

function stageFile(cwd, file) {
  gitExec(`add "${sanitizePath(file)}"`, cwd);
  return true;
}

function stageAll(cwd) {
  gitExec('add -A', cwd);
  return true;
}

function unstageFile(cwd, file) {
  gitExec(`reset HEAD "${sanitizePath(file)}"`, cwd);
  return true;
}

function unstageAll(cwd) {
  gitExec('reset HEAD', cwd);
  return true;
}

function discardFile(cwd, file) {
  gitExec(`checkout -- "${sanitizePath(file)}"`, cwd);
  return true;
}

// ═══ COMMIT ═══

function commit(cwd, message) {
  if (!message || !message.trim()) throw new Error('Commit message required');
  // Use stdin to avoid shell escaping issues
  try {
    return execSync('git commit -F -', {
      input: message,
      encoding: 'utf8',
      timeout: 15000,
      cwd,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim();
  } catch (err) {
    throw new Error(err.stderr ? err.stderr.trim() : err.message);
  }
}

// ═══ STASH ═══

function getStashes(cwd) {
  const raw = gitExec('stash list --format="%gd|%s|%ai"', cwd);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const [ref, message, date] = line.split('|');
    return { ref, message, date };
  });
}

function stashPush(cwd, message) {
  let args = 'stash push';
  if (message) args += ` -m "${message.replace(/"/g, '')}"`;
  return gitExec(args, cwd);
}

function stashPop(cwd, index = 0) {
  return gitExec(`stash pop stash@{${parseInt(index) || 0}}`, cwd);
}

function stashDrop(cwd, index = 0) {
  return gitExec(`stash drop stash@{${parseInt(index) || 0}}`, cwd);
}

function stashShow(cwd, index = 0) {
  return gitExec(`stash show -p stash@{${parseInt(index) || 0}}`, cwd);
}

// ═══ REMOTES ═══

function getRemotes(cwd) {
  const raw = gitExec('remote -v', cwd);
  if (!raw) return [];
  const remotes = new Map();
  for (const line of raw.split('\n').filter(Boolean)) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)/);
    if (match) {
      if (!remotes.has(match[1])) {
        remotes.set(match[1], { name: match[1], fetchUrl: '', pushUrl: '' });
      }
      const r = remotes.get(match[1]);
      if (match[3] === 'fetch') r.fetchUrl = match[2];
      else r.pushUrl = match[2];
    }
  }
  return [...remotes.values()];
}

function fetch(cwd, remote = 'origin') {
  return gitExec(`fetch ${sanitizeBranch(remote)}`, cwd, 30000);
}

function pull(cwd, remote = 'origin', branch) {
  let args = `pull ${sanitizeBranch(remote)}`;
  if (branch) args += ` ${sanitizeBranch(branch)}`;
  return gitExec(args, cwd, 60000);
}

function push(cwd, remote = 'origin', branch) {
  let args = `push ${sanitizeBranch(remote)}`;
  if (branch) args += ` ${sanitizeBranch(branch)}`;
  return gitExec(args, cwd, 60000);
}

// ═══ TAGS ═══

function getTags(cwd) {
  const raw = gitExec('tag -l --format="%(refname:short)|%(objectname:short)|%(creatordate:iso)"', cwd);
  if (!raw) return [];
  return raw.split('\n').filter(Boolean).map(line => {
    const [name, hash, date] = line.split('|');
    return { name, hash, date };
  });
}

// ═══ BLAME ═══

function blame(cwd, file) {
  const raw = gitExec(`blame --porcelain "${sanitizePath(file)}"`, cwd, 30000);
  if (!raw) return [];

  const lines = raw.split('\n');
  const result = [];
  let current = {};

  for (const line of lines) {
    if (line.match(/^[0-9a-f]{40}\s/)) {
      if (current.hash) result.push(current);
      const parts = line.split(' ');
      current = { hash: parts[0], origLine: parseInt(parts[1]), finalLine: parseInt(parts[2]) };
    } else if (line.startsWith('author ')) {
      current.author = line.slice(7);
    } else if (line.startsWith('author-time ')) {
      current.timestamp = parseInt(line.slice(12));
    } else if (line.startsWith('summary ')) {
      current.summary = line.slice(8);
    } else if (line.startsWith('\t')) {
      current.content = line.slice(1);
    }
  }
  if (current.hash) result.push(current);

  return result;
}

// ═══ FILE HISTORY ═══

function getFileHistory(cwd, file, limit = 20) {
  return getLog(cwd, { limit, file });
}

// ═══ SANITIZATION ═══

function sanitizeHash(hash) {
  return hash.replace(/[^a-zA-Z0-9~^.]/g, '');
}

function sanitizeBranch(name) {
  // Allow: alphanumeric, -, _, /, .
  return name.replace(/[^a-zA-Z0-9_.\-\/]/g, '');
}

function sanitizePath(p) {
  // Remove potential command injection
  return p.replace(/[`$;|&><]/g, '');
}

// ═══ EXPORTS ═══
module.exports = {
  isGitRepo,
  getRepoRoot,
  getRepoInfo,

  getStatus,
  parseStatusChar,

  getLog,
  getCommitDetail,

  getDiff,
  getDiffStats,

  getBranches,
  createBranch,
  checkoutBranch,
  deleteBranch,
  mergeBranch,

  stageFile,
  stageAll,
  unstageFile,
  unstageAll,
  discardFile,

  commit,

  getStashes,
  stashPush,
  stashPop,
  stashDrop,
  stashShow,

  getRemotes,
  fetch,
  pull,
  push,

  getTags,
  blame,
  getFileHistory,

  // Utilities (for testing)
  sanitizeHash,
  sanitizeBranch,
  sanitizePath,
};
