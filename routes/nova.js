const express = require('express');
const router = express.Router();
const nova = require('../services/nova');
const { v4: uuid } = require('uuid');
const { execSync } = require('child_process');
const os = require('os');
const { resolveAppName } = require('../services/appDiscovery');

// Sanitize for osascript
function shellSafe(s) { return (s || '').replace(/[`$(){}|;&<>\\]/g, ''); }
function osascriptSafe(s) { return (s || '').replace(/["\\]/g, '').replace(/[`$]/g, ''); }

// Execute a workflow by name (used by NOVA)
function runWorkflowByName(db, name) {
  const wf = db.prepare('SELECT * FROM workflow_profiles WHERE LOWER(name) LIKE ?').get(`%${name.toLowerCase()}%`);
  if (!wf) return { success: false, message: `Workflow "${name}" not found` };

  const actions = JSON.parse(wf.actions || '[]');
  const results = [];
  for (const action of actions) {
    const appName = resolveAppName(shellSafe(action.app || ''));
    let cmd;
    if (action.type === 'open') {
      cmd = process.platform === 'darwin'
        ? `open -a "${appName}" ${shellSafe(action.args || '')}`.trim()
        : `xdg-open "${appName}" 2>/dev/null`;
    } else if (action.type === 'close') {
      cmd = process.platform === 'darwin'
        ? `osascript -e 'quit app "${osascriptSafe(appName)}"' 2>/dev/null`
        : `pkill -f "${shellSafe(appName)}" 2>/dev/null`;
    } else if (action.type === 'command') {
      cmd = shellSafe(action.command || 'echo "no command"');
    } else continue;

    try {
      execSync(cmd, { encoding: 'utf8', timeout: 10000, cwd: os.homedir() });
      results.push(`✓ ${action.type}: ${appName}`);
    } catch {
      results.push(`✗ ${action.type}: ${appName}`);
    }
  }
  return { success: true, workflow: wf.name, output: results.join('\n'), actionCount: actions.length };
}

// Execute NOVA code
router.post('/run', (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ error: 'No NOVA code provided' });

  try {
    const results = nova.run(code);
    const db = req.app.locals.db;

    // Process special result types
    for (const r of results) {
      // Handle workflow execution
      if (r.type === 'workflow' && r.workflowName) {
        const wfResult = runWorkflowByName(db, r.workflowName);
        r.result = wfResult.success
          ? `Executed workflow "${wfResult.workflow}" (${wfResult.actionCount} actions):\n${wfResult.output}`
          : wfResult.message;
        r.command = `workflow: ${r.workflowName}`;
      }

      // Handle agent auto-creation from schedule
      if (r.agentData && r.agentData.command) {
        const ad = r.agentData;
        const name = ad.type === 'interval'
          ? `NOVA: every ${ad.interval} ${ad.unit}`
          : `NOVA: at ${ad.time}`;

        let script;
        if (ad.type === 'interval') {
          let ms = ad.interval * 1000;
          if (ad.unit === 'minute') ms *= 60;
          else if (ad.unit === 'hour') ms *= 3600;
          script = `const { execSync } = require('child_process');\nsetInterval(() => {\n  try {\n    const out = execSync(${JSON.stringify(ad.command)}, { encoding: 'utf8', timeout: 30000 });\n    console.log(out);\n  } catch (err) {\n    console.error(err.message);\n  }\n}, ${ms});`;
        } else {
          script = `const { execSync } = require('child_process');\nsetInterval(() => {\n  const now = new Date();\n  const h = now.getHours(), m = now.getMinutes();\n  try {\n    execSync(${JSON.stringify(ad.command)}, { encoding: 'utf8', timeout: 30000 });\n  } catch (err) {\n    console.error(err.message);\n  }\n}, 60000);`;
        }

        try {
          const agentId = uuid();
          db.prepare('INSERT INTO agents (id, name, description, type, script, schedule, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(agentId, name, `Auto-created from NOVA schedule command`, 'javascript', script, ad.type === 'interval' ? `*/${ad.interval} * * * *` : ad.time, 'running');
          r.result = `Agent "${name}" created and auto-started.`;
        } catch {}
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.json({ success: false, error: err.message, results: [] });
  }
});

// Explain NOVA code (parse + compile, no execution)
router.post('/explain', (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ error: 'No NOVA code provided' });

  try {
    const steps = nova.explain(code);
    res.json({ success: true, steps });
  } catch (err) {
    res.json({ success: false, error: err.message, steps: [] });
  }
});

// Get example programs
router.get('/examples', (req, res) => {
  res.json(nova.EXAMPLES);
});

module.exports = router;
