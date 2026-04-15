const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { notify } = require('../services/notify');
const cronScheduler = require('../services/cronScheduler');

// Track running agent processes
const runningAgents = new Map();

// Agent presets (must be ABOVE /:id to avoid route conflict)
router.get('/presets/list', (req, res) => {
  res.json([
    {
      name: 'File Watcher',
      description: 'Watch a directory for changes and log them',
      type: 'javascript',
      script: `const fs = require('fs');
const path = process.env.WATCH_DIR || '.';
console.log('Watching:', path);
fs.watch(path, { recursive: true }, (event, filename) => {
  console.log(new Date().toISOString(), event, filename);
});`,
    },
    {
      name: 'System Monitor',
      description: 'Log CPU and memory usage every 10 seconds',
      type: 'javascript',
      script: `const os = require('os');
setInterval(() => {
  const mem = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100);
  const load = os.loadavg()[0].toFixed(2);
  console.log(\`[\${new Date().toISOString()}] CPU: \${load} | MEM: \${mem}%\`);
}, 10000);
console.log('System monitor started');`,
    },
    {
      name: 'URL Health Check',
      description: 'Ping a URL every 30 seconds and log status',
      type: 'javascript',
      script: `const https = require('https');
const url = process.env.CHECK_URL || 'https://google.com';
function check() {
  const start = Date.now();
  https.get(url, (res) => {
    console.log(\`[\${new Date().toISOString()}] \${url} -> \${res.statusCode} (\${Date.now()-start}ms)\`);
  }).on('error', (e) => {
    console.error(\`[\${new Date().toISOString()}] \${url} -> ERROR: \${e.message}\`);
  });
}
check();
setInterval(check, 30000);`,
    },
    {
      name: 'Disk Space Alert',
      description: 'Alert when disk usage exceeds threshold',
      type: 'bash',
      script: `#!/bin/bash
THRESHOLD=\${THRESHOLD:-80}
while true; do
  USAGE=$(df -h / | awk 'NR==2{print $5}' | tr -d '%')
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  if [ "$USAGE" -gt "$THRESHOLD" ]; then
    echo "[$TIMESTAMP] WARNING: Disk usage at $USAGE% (threshold: $THRESHOLD%)"
  else
    echo "[$TIMESTAMP] OK: Disk usage at $USAGE%"
  fi
  sleep 60
done`,
    },
    {
      name: 'Python Data Collector',
      description: 'Collect and log system metrics using Python',
      type: 'python',
      script: `import time, os, json, platform
while True:
    metrics = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "platform": platform.system(),
        "python": platform.python_version(),
        "cpu_count": os.cpu_count(),
        "load_avg": os.getloadavg(),
    }
    print(json.dumps(metrics))
    time.sleep(15)`,
    },
  ]);
});

// List all agents
router.get('/', (req, res) => {
  const db = req.app.locals.db;
  const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();

  // Update status from running map
  agents.forEach(a => {
    if (runningAgents.has(a.id)) {
      a.status = 'running';
      a.pid = runningAgents.get(a.id).pid;
    }
  });

  res.json(agents);
});

// Get agent with logs
router.get('/:id', (req, res) => {
  const db = req.app.locals.db;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  const logs = db.prepare('SELECT * FROM agent_logs WHERE agent_id = ? ORDER BY created_at DESC LIMIT 100')
    .all(req.params.id);

  res.json({ agent, logs });
});

// Create agent
router.post('/', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, type = 'script', script, schedule, env } = req.body;
  const id = uuidv4();

  db.prepare(`INSERT INTO agents (id, name, description, type, script, schedule, env)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, description || '', type, script || '', schedule || null, JSON.stringify(env || {})
  );

  // Save script to file
  if (script) {
    const agentDir = path.join(__dirname, '..', 'agents', id);
    fs.mkdirSync(agentDir, { recursive: true });

    const ext = type === 'python' ? '.py' : type === 'bash' ? '.sh' : '.js';
    fs.writeFileSync(path.join(agentDir, `agent${ext}`), script);
  }

  res.json({ id });
});

// Update agent
router.put('/:id', (req, res) => {
  const db = req.app.locals.db;
  const { name, description, script, schedule, env } = req.body;

  db.prepare(`UPDATE agents SET name=COALESCE(?,name), description=COALESCE(?,description),
    script=COALESCE(?,script), schedule=COALESCE(?,schedule), env=COALESCE(?,env) WHERE id=?`)
    .run(name, description, script, schedule, env ? JSON.stringify(env) : null, req.params.id);

  // Update script file
  if (script) {
    const agent = db.prepare('SELECT type FROM agents WHERE id = ?').get(req.params.id);
    const agentDir = path.join(__dirname, '..', 'agents', req.params.id);
    fs.mkdirSync(agentDir, { recursive: true });
    const ext = agent?.type === 'python' ? '.py' : agent?.type === 'bash' ? '.sh' : '.js';
    fs.writeFileSync(path.join(agentDir, `agent${ext}`), script);
  }

  res.json({ ok: true });
});

// Start agent
router.post('/:id/start', (req, res) => {
  const db = req.app.locals.db;
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  if (runningAgents.has(agent.id)) {
    return res.status(400).json({ error: 'Agent already running' });
  }

  const agentEnv = { ...process.env };
  try {
    Object.assign(agentEnv, JSON.parse(agent.env || '{}'));
  } catch {}

  // Determine how to run
  let cmd, args;
  const agentDir = path.join(__dirname, '..', 'agents', agent.id);

  if (agent.type === 'python') {
    cmd = 'python3';
    args = [path.join(agentDir, 'agent.py')];
  } else if (agent.type === 'bash' || agent.type === 'shell') {
    cmd = 'bash';
    args = [path.join(agentDir, 'agent.sh')];
  } else {
    cmd = 'node';
    args = [path.join(agentDir, 'agent.js')];
  }

  // If inline script (no file), write temp file
  if (agent.script && !fs.existsSync(args[0])) {
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(args[0], agent.script);
  }

  const proc = spawn(cmd, args, {
    cwd: agentDir,
    env: agentEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  runningAgents.set(agent.id, proc);

  const logInsert = db.prepare('INSERT INTO agent_logs (agent_id, type, message) VALUES (?, ?, ?)');

  proc.stdout.on('data', (data) => {
    const msg = data.toString();
    try { logInsert.run(agent.id, 'stdout', msg); } catch {}
    db.prepare('UPDATE agents SET last_output = ? WHERE id = ?').run(msg.slice(-5000), agent.id);
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString();
    try { logInsert.run(agent.id, 'stderr', msg); } catch {}
    db.prepare('UPDATE agents SET last_error = ? WHERE id = ?').run(msg.slice(-5000), agent.id);
  });

  proc.on('close', (code) => {
    runningAgents.delete(agent.id);
    const status = code === 0 ? 'completed' : 'failed';
    db.prepare('UPDATE agents SET status = ?, last_run = datetime(\'now\'), pid = NULL WHERE id = ?')
      .run(status, agent.id);
    logInsert.run(agent.id, 'system', `Agent exited with code ${code}`);
    notify(db, {
      title: status === 'completed' ? 'Agent Completed' : 'Agent Failed',
      message: `"${agent.name}" exited with code ${code}`,
      source: 'agent',
      level: status === 'completed' ? 'success' : 'error',
    });
  });

  proc.on('error', (err) => {
    runningAgents.delete(agent.id);
    db.prepare('UPDATE agents SET status = ?, last_error = ? WHERE id = ?')
      .run('failed', err.message, agent.id);
    notify(db, { title: 'Agent Error', message: `"${agent.name}": ${err.message}`, source: 'agent', level: 'error' });
  });

  db.prepare('UPDATE agents SET status = ?, pid = ? WHERE id = ?')
    .run('running', proc.pid, agent.id);

  notify(db, { title: 'Agent Started', message: `"${agent.name}" is now running (PID ${proc.pid})`, source: 'agent', level: 'info' });

  res.json({ ok: true, pid: proc.pid });
});

// Stop agent
router.post('/:id/stop', (req, res) => {
  const db = req.app.locals.db;
  const proc = runningAgents.get(req.params.id);

  if (proc) {
    proc.kill('SIGTERM');
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch {}
    }, 5000);
    runningAgents.delete(req.params.id);
  }

  db.prepare('UPDATE agents SET status = ?, pid = NULL WHERE id = ?').run('stopped', req.params.id);
  res.json({ ok: true });
});

// Delete agent
router.delete('/:id', (req, res) => {
  const db = req.app.locals.db;

  // Stop if running
  const proc = runningAgents.get(req.params.id);
  if (proc) { proc.kill(); runningAgents.delete(req.params.id); }

  // Delete files
  const agentDir = path.join(__dirname, '..', 'agents', req.params.id);
  try { fs.rmSync(agentDir, { recursive: true }); } catch {}

  db.prepare('DELETE FROM agent_logs WHERE agent_id = ?').run(req.params.id);
  db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);

  res.json({ ok: true });
});

// Clear logs
router.delete('/:id/logs', (req, res) => {
  req.app.locals.db.prepare('DELETE FROM agent_logs WHERE agent_id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Set cron schedule
router.put('/:id/schedule', (req, res) => {
  const db = req.app.locals.db;
  const { schedule } = req.body;

  if (schedule) {
    const validation = cronScheduler.validateCron(schedule);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
  }

  db.prepare('UPDATE agents SET schedule = ? WHERE id = ?').run(schedule || null, req.params.id);
  res.json({ ok: true, nextRun: schedule ? cronScheduler.getNextRun(schedule)?.toISOString() : null });
});

// Get cron run history
router.get('/:id/runs', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(cronScheduler.getCronRuns(req.params.id, limit));
});

// Validate cron expression
router.post('/cron/validate', (req, res) => {
  const { expression } = req.body;
  res.json(cronScheduler.validateCron(expression || ''));
});

// Get cron presets
router.get('/cron/presets', (req, res) => {
  res.json(cronScheduler.PRESETS);
});

module.exports = router;
