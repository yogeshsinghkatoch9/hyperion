const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Language configurations
const LANGUAGES = {
  python: { cmd: 'python3', ext: '.py', name: 'Python' },
  python2: { cmd: 'python', ext: '.py', name: 'Python 2' },
  javascript: { cmd: 'node', ext: '.js', name: 'JavaScript' },
  typescript: { cmd: 'npx', args: ['ts-node'], ext: '.ts', name: 'TypeScript' },
  bash: { cmd: 'bash', ext: '.sh', name: 'Bash' },
  zsh: { cmd: 'zsh', ext: '.sh', name: 'Zsh' },
  ruby: { cmd: 'ruby', ext: '.rb', name: 'Ruby' },
  perl: { cmd: 'perl', ext: '.pl', name: 'Perl' },
  php: { cmd: 'php', ext: '.php', name: 'PHP' },
  go: { cmd: 'go', args: ['run'], ext: '.go', name: 'Go' },
  rust: { cmd: 'rustc', ext: '.rs', name: 'Rust', compile: true },
  c: { cmd: 'gcc', ext: '.c', name: 'C', compile: true, run: true },
  cpp: { cmd: 'g++', ext: '.cpp', name: 'C++', compile: true, run: true },
  swift: { cmd: 'swift', ext: '.swift', name: 'Swift' },
  r: { cmd: 'Rscript', ext: '.R', name: 'R' },
  lua: { cmd: 'lua', ext: '.lua', name: 'Lua' },
  shell: { cmd: 'sh', ext: '.sh', name: 'Shell' },
  nova: { cmd: 'node', ext: '.nova', name: 'NOVA', custom: true },
};

// List available languages (check which are installed)
router.get('/languages', async (req, res) => {
  const available = [];
  for (const [key, lang] of Object.entries(LANGUAGES)) {
    try {
      const check = spawn('which', [lang.cmd]);
      const found = await new Promise((resolve) => {
        check.on('close', (code) => resolve(code === 0));
        setTimeout(() => { check.kill(); resolve(false); }, 2000);
      });
      available.push({ id: key, ...lang, installed: found });
    } catch {
      available.push({ id: key, ...lang, installed: false });
    }
  }
  res.json(available);
});

// Execute code
router.post('/run', async (req, res) => {
  const { code, language = 'python', stdin, timeout = 30000, cwd } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const lang = LANGUAGES[language];
  if (!lang) return res.status(400).json({ error: `Unknown language: ${language}` });

  // NOVA: use the NOVA engine directly
  if (language === 'nova') {
    const nova = require('../services/nova');
    const startTime = Date.now();
    try {
      const results = nova.run(code);
      const stdout = results.map(r => r.result || '').filter(Boolean).join('\n');
      const hasError = results.some(r => r.exitCode > 0);
      const duration = Date.now() - startTime;
      // Save NOVA runs to history
      try {
        req.app.locals.db.prepare(
          'INSERT INTO command_history (command, language, output, exit_code, duration_ms) VALUES (?, ?, ?, ?, ?)'
        ).run(code.slice(0, 5000), 'nova', stdout.slice(0, 10000), hasError ? 1 : 0, duration);
      } catch {}
      return res.json({ stdout, stderr: '', exitCode: hasError ? 1 : 0, duration, language });
    } catch (err) {
      return res.json({ stdout: '', stderr: err.message, exitCode: 1, duration: Date.now() - startTime, language });
    }
  }

  const tmpDir = os.tmpdir();
  const fileId = uuidv4();
  const filePath = path.join(tmpDir, `hyperion_${fileId}${lang.ext}`);
  const startTime = Date.now();

  try {
    fs.writeFileSync(filePath, code);

    let result;
    if (lang.compile && lang.run) {
      // C/C++: compile then run
      const outPath = path.join(tmpDir, `hyperion_${fileId}`);
      const compileResult = await execCommand(lang.cmd, [filePath, '-o', outPath], { timeout, cwd });
      if (compileResult.exitCode !== 0) {
        result = { ...compileResult, phase: 'compile' };
      } else {
        result = await execCommand(outPath, [], { timeout, cwd, stdin });
        result.phase = 'run';
        try { fs.unlinkSync(outPath); } catch {}
      }
    } else if (lang.compile) {
      // Rust: compile and run
      const outPath = path.join(tmpDir, `hyperion_${fileId}`);
      const compileResult = await execCommand(lang.cmd, [filePath, '-o', outPath], { timeout, cwd });
      if (compileResult.exitCode !== 0) {
        result = compileResult;
      } else {
        result = await execCommand(outPath, [], { timeout, cwd, stdin });
        try { fs.unlinkSync(outPath); } catch {}
      }
    } else {
      const args = [...(lang.args || []), filePath];
      result = await execCommand(lang.cmd, args, { timeout, cwd: cwd || path.dirname(filePath), stdin });
    }

    const duration = Date.now() - startTime;

    // Save to history
    try {
      req.app.locals.db.prepare(
        'INSERT INTO command_history (command, language, output, exit_code, duration_ms) VALUES (?, ?, ?, ?, ?)'
      ).run(code.slice(0, 5000), language, (result.stdout + result.stderr).slice(0, 10000), result.exitCode, duration);
    } catch {}

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration,
      language,
      phase: result.phase,
    });
  } catch (err) {
    res.json({ stdout: '', stderr: err.message, exitCode: 1, duration: Date.now() - startTime, language });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
});

// Execute a raw shell command
router.post('/exec', async (req, res) => {
  const { command, cwd, timeout = 30000 } = req.body;
  if (!command) return res.status(400).json({ error: 'No command provided' });

  const startTime = Date.now();
  try {
    const result = await execCommand('bash', ['-c', command], {
      timeout,
      cwd: cwd || process.env.HOME,
    });

    res.json({
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration: Date.now() - startTime,
    });
  } catch (err) {
    res.json({ stdout: '', stderr: err.message, exitCode: 1, duration: Date.now() - startTime });
  }
});

// Command history
router.get('/history', (req, res) => {
  const db = req.app.locals.db;
  const limit = parseInt(req.query.limit) || 50;
  const rows = db.prepare('SELECT * FROM command_history ORDER BY created_at DESC LIMIT ?').all(limit);
  res.json(rows);
});

// Snippets CRUD
router.get('/snippets', (req, res) => {
  const db = req.app.locals.db;
  res.json(db.prepare('SELECT * FROM snippets ORDER BY created_at DESC').all());
});

router.post('/snippets', (req, res) => {
  const db = req.app.locals.db;
  const { name, language, code, tags } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO snippets (id, name, language, code, tags) VALUES (?,?,?,?,?)')
    .run(id, name, language || 'python', code, JSON.stringify(tags || []));
  res.json({ id });
});

router.delete('/snippets/:id', (req, res) => {
  req.app.locals.db.prepare('DELETE FROM snippets WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Install a package
router.post('/install', async (req, res) => {
  const { package: pkg, manager = 'pip' } = req.body;
  if (!pkg) return res.status(400).json({ error: 'No package specified' });

  const cmds = {
    pip: ['pip3', ['install', pkg]],
    npm: ['npm', ['install', '-g', pkg]],
    brew: ['brew', ['install', pkg]],
    gem: ['gem', ['install', pkg]],
  };

  const [cmd, args] = cmds[manager] || cmds.pip;
  const result = await execCommand(cmd, args, { timeout: 120000 });
  res.json(result);
});

function execCommand(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      cwd: opts.cwd || process.env.HOME,
      env: { ...process.env, ...opts.env },
      maxBuffer: 10 * 1024 * 1024,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    if (opts.stdin) {
      proc.stdin.write(opts.stdin);
      proc.stdin.end();
    }

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      stderr += '\n[TIMEOUT: Process killed after ' + (opts.timeout / 1000) + 's]';
    }, opts.timeout || 30000);

    proc.on('close', (exitCode) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: err.message, exitCode: 1 });
    });
  });
}

module.exports = router;
