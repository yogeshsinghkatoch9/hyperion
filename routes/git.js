const express = require('express');
const router = express.Router();
const git = require('../services/git');

// All routes expect ?cwd= or body.cwd for the repository path
function getCwd(req) {
  return req.query.cwd || req.body?.cwd || process.env.HOME || '/';
}

// GET /api/git/status — Full repo status
router.get('/status', (req, res) => {
  const cwd = getCwd(req);
  try {
    if (!git.isGitRepo(cwd)) return res.json({ isRepo: false });
    const info = git.getRepoInfo(cwd);
    const status = git.getStatus(cwd);
    res.json({ isRepo: true, ...info, ...status });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/git/log — Commit history
router.get('/log', (req, res) => {
  try {
    const { limit, skip, branch, author, search, file } = req.query;
    const log = git.getLog(getCwd(req), {
      limit: limit ? parseInt(limit) : 50,
      skip: skip ? parseInt(skip) : 0,
      branch, author, search, file,
    });
    res.json(log);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/git/commit/:hash — Commit detail
router.get('/commit/:hash', (req, res) => {
  try {
    res.json(git.getCommitDetail(getCwd(req), req.params.hash));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/git/diff — Diff (working/staged/commit)
router.get('/diff', (req, res) => {
  try {
    const { staged, file, commit, commit2 } = req.query;
    const diff = git.getDiff(getCwd(req), {
      staged: staged === 'true', file, commit, commit2,
    });
    res.json({ diff });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Branches ──
router.get('/branches', (req, res) => {
  try { res.json(git.getBranches(getCwd(req))); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/branches', (req, res) => {
  try {
    const { name, startPoint } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name required' });
    git.createBranch(getCwd(req), name, startPoint);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/branches/checkout', (req, res) => {
  try {
    git.checkoutBranch(getCwd(req), req.body.name);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/branches/:name', (req, res) => {
  try {
    git.deleteBranch(getCwd(req), req.params.name, req.query.force === 'true');
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/branches/merge', (req, res) => {
  try {
    const output = git.mergeBranch(getCwd(req), req.body.name);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Staging ──
router.post('/stage', (req, res) => {
  try {
    const { file } = req.body;
    if (file) git.stageFile(getCwd(req), file);
    else git.stageAll(getCwd(req));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/unstage', (req, res) => {
  try {
    const { file } = req.body;
    if (file) git.unstageFile(getCwd(req), file);
    else git.unstageAll(getCwd(req));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/discard', (req, res) => {
  try {
    git.discardFile(getCwd(req), req.body.file);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Commit ──
router.post('/commit', (req, res) => {
  try {
    const output = git.commit(getCwd(req), req.body.message);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Stash ──
router.get('/stash', (req, res) => {
  try { res.json(git.getStashes(getCwd(req))); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/stash/push', (req, res) => {
  try {
    const output = git.stashPush(getCwd(req), req.body.message);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/stash/pop', (req, res) => {
  try {
    const output = git.stashPop(getCwd(req), req.body.index);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/stash/:index', (req, res) => {
  try {
    git.stashDrop(getCwd(req), parseInt(req.params.index));
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.get('/stash/:index', (req, res) => {
  try {
    const diff = git.stashShow(getCwd(req), parseInt(req.params.index));
    res.json({ diff });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Remotes ──
router.get('/remotes', (req, res) => {
  try { res.json(git.getRemotes(getCwd(req))); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/fetch', (req, res) => {
  try {
    const output = git.fetch(getCwd(req), req.body?.remote);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/pull', (req, res) => {
  try {
    const output = git.pull(getCwd(req), req.body?.remote, req.body?.branch);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/push', (req, res) => {
  try {
    const output = git.push(getCwd(req), req.body?.remote, req.body?.branch);
    res.json({ ok: true, output });
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Tags ──
router.get('/tags', (req, res) => {
  try { res.json(git.getTags(getCwd(req))); }
  catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Blame ──
router.get('/blame', (req, res) => {
  try {
    const { file } = req.query;
    if (!file) return res.status(400).json({ error: 'File path required' });
    res.json(git.blame(getCwd(req), file));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

module.exports = router;
