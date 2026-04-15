/* ═══ HYPERION — Diff Viewer Service ═══ */
const { v4: uuid } = require('uuid');

/**
 * Compute line-by-line diff using a simple LCS-based approach.
 * Returns array of { type: 'equal'|'add'|'remove', line, lineA, lineB }
 */
function computeDiff(textA, textB) {
  const linesA = (textA || '').split('\n');
  const linesB = (textB || '').split('\n');
  const m = linesA.length;
  const n = linesB.length;

  // Build LCS table
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build diff
  const diff = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      diff.unshift({ type: 'equal', line: linesA[i - 1], lineA: i, lineB: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'add', line: linesB[j - 1], lineA: null, lineB: j });
      j--;
    } else {
      diff.unshift({ type: 'remove', line: linesA[i - 1], lineA: i, lineB: null });
      i--;
    }
  }

  return diff;
}

/** Character-level diff for inline highlighting within a changed line */
function computeCharDiff(lineA, lineB) {
  const a = lineA || '';
  const b = lineB || '';
  const m = a.length;
  const n = b.length;

  // Simple LCS for characters
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const result = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'equal', char: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: 'add', char: b[j - 1] });
      j--;
    } else {
      result.unshift({ type: 'remove', char: a[i - 1] });
      i--;
    }
  }

  return result;
}

/** Format diff as unified diff string */
function formatUnified(diff, contextLines = 3) {
  const lines = [];
  lines.push('--- a');
  lines.push('+++ b');

  let hunkStart = -1;
  for (let i = 0; i < diff.length; i++) {
    if (diff[i].type !== 'equal') {
      if (hunkStart === -1) hunkStart = Math.max(0, i - contextLines);
      const hunkEnd = Math.min(diff.length, i + contextLines + 1);
      // Find next change or end
      let nextChange = diff.length;
      for (let k = i + 1; k < diff.length; k++) {
        if (diff[k].type !== 'equal') { nextChange = k; break; }
        if (k - i > contextLines * 2) break;
      }
      i = nextChange - 1;
    }
  }

  // Simple unified output
  for (const entry of diff) {
    const prefix = entry.type === 'add' ? '+' : entry.type === 'remove' ? '-' : ' ';
    lines.push(`${prefix}${entry.line}`);
  }

  return lines.join('\n');
}

/** Get diff statistics */
function getStats(diff) {
  let additions = 0, deletions = 0, unchanged = 0;
  for (const entry of diff) {
    if (entry.type === 'add') additions++;
    else if (entry.type === 'remove') deletions++;
    else unchanged++;
  }
  return {
    additions,
    deletions,
    unchanged,
    totalA: deletions + unchanged,
    totalB: additions + unchanged,
  };
}

/** Apply diff to reconstruct textB from textA */
function applyPatch(original, diff) {
  const lines = [];
  for (const entry of diff) {
    if (entry.type === 'equal' || entry.type === 'add') {
      lines.push(entry.line);
    }
  }
  return lines.join('\n');
}

/** Save diff snapshot to DB */
function saveSnapshot(db, { name, textA, textB, stats }) {
  const id = uuid();
  const statsJson = JSON.stringify(stats || {});
  db.prepare('INSERT INTO diff_snapshots (id, name, text_a, text_b, stats) VALUES (?, ?, ?, ?, ?)')
    .run(id, name || 'Untitled', textA || '', textB || '', statsJson);
  return { id, name, stats };
}

/** List snapshots */
function getSnapshots(db) {
  return db.prepare('SELECT id, name, stats, created_at FROM diff_snapshots ORDER BY created_at DESC').all()
    .map(r => ({ ...r, stats: JSON.parse(r.stats || '{}') }));
}

/** Get snapshot by id */
function getSnapshot(db, id) {
  const row = db.prepare('SELECT * FROM diff_snapshots WHERE id = ?').get(id);
  if (!row) throw new Error('Snapshot not found');
  return { ...row, stats: JSON.parse(row.stats || '{}') };
}

/** Delete snapshot */
function deleteSnapshot(db, id) {
  const info = db.prepare('DELETE FROM diff_snapshots WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Snapshot not found');
}

module.exports = {
  computeDiff, computeCharDiff, formatUnified,
  getStats, applyPatch,
  saveSnapshot, getSnapshots, getSnapshot, deleteSnapshot,
};
