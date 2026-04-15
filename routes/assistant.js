const express = require('express');
const router = express.Router();
const { translate, QUICK_ACTIONS } = require('../services/commandTranslator');
const { resolveAppName } = require('../services/appDiscovery');
const { getSuggestions } = require('../services/suggestions');
const { generateCommand, isConfigured, callWithFailover, getInjectedSystemPrompt, defaultSystemPrompt } = require('../services/llmService');
const skillLoader = require('../services/skillLoader');
const vectorMemory = require('../services/vectorMemory');
const { spawn } = require('child_process');
const { execSync } = require('child_process');
const os = require('os');

// Sanitize strings for shell and osascript safety
function shellSafe(s) { return (s || '').replace(/[`$(){}|;&<>\\]/g, ''); }
function osascriptSafe(s) { return (s || '').replace(/["\\]/g, '').replace(/[`$]/g, ''); }

// Translate natural language to command
router.post('/translate', (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'No input' });
  const result = translate(input);
  res.json(result);
});

// Translate AND execute
router.post('/ask', async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'No input' });

  const db = req.app.locals.db;

  // Check for workflow match first: "start dev mode", "launch writing mode"
  const workflowMatch = input.match(/^(?:start|launch|run|activate)\s+(.+?)(?:\s+mode)?$/i);
  if (workflowMatch) {
    const wfName = workflowMatch[1].trim();
    try {
      const wf = db.prepare('SELECT * FROM workflow_profiles WHERE LOWER(name) LIKE ?').get(`%${wfName.toLowerCase()}%`);
      if (wf) {
        const actions = JSON.parse(wf.actions || '[]');
        const results = [];
        for (const action of actions) {
          const appName = resolveAppName(shellSafe(action.app || ''));
          let cmd;
          if (action.type === 'open') {
            const safeArgs = shellSafe(action.args || '');
            cmd = process.platform === 'darwin'
              ? `open -a "${appName}" ${safeArgs}`.trim()
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

        const duration = 0;
        try {
          db.prepare('INSERT INTO command_history (command, language, output, exit_code, duration_ms) VALUES (?, ?, ?, ?, ?)')
            .run(`workflow: ${wf.name}`, 'assistant', results.join('\n'), 0, duration);
        } catch {}

        return res.json({
          success: true,
          input,
          command: `workflow: ${wf.name}`,
          description: `Executed workflow "${wf.name}" (${actions.length} actions)`,
          stdout: results.join('\n'),
          stderr: '',
          exitCode: 0,
          duration,
        });
      }
    } catch {}
  }

  // Skill matching step — check before commandTranslator
  const matchedSkill = skillLoader.matchSkill(input);

  // Standard translation path
  const translated = translate(input);

  if (!translated.command) {
    // LLM fallback: if configured, try AI generation
    if (isConfigured()) {
      try {
        // Build messages with prompt injection + skill context
        const systemParts = [getInjectedSystemPrompt(defaultSystemPrompt())];
        if (matchedSkill) systemParts.push(`\n[Active Skill: ${matchedSkill.name}]\n${matchedSkill.instructions}`);

        const aiResult = await generateCommand(input);
        if (aiResult && aiResult.command) {
          return res.json({
            success: true,
            input,
            aiGenerated: true,
            needsApproval: true,
            command: aiResult.command,
            description: `AI-generated command (${aiResult.provider})${matchedSkill ? ` [Skill: ${matchedSkill.name}]` : ''}`,
            provider: aiResult.provider,
            skill: matchedSkill ? matchedSkill.name : null,
          });
        }
        if (aiResult && aiResult.rejected) {
          return res.json({
            success: false,
            input,
            message: aiResult.reason || 'Command rejected for safety reasons',
          });
        }
      } catch {}
    }

    return res.json({
      success: false,
      input,
      message: "I'm not sure how to do that. Try one of these:",
      suggestions: translated.suggestions,
    });
  }

  const startTime = Date.now();
  try {
    const result = await execCommand(translated.command, { timeout: 30000 });
    const duration = Date.now() - startTime;

    try {
      db.prepare('INSERT INTO command_history (command, language, output, exit_code, duration_ms) VALUES (?, ?, ?, ?, ?)')
        .run(translated.command, 'assistant', (result.stdout + result.stderr).slice(0, 10000), result.exitCode, duration);
    } catch {}

    // Store in vector memory
    try {
      await vectorMemory.store(`Q: ${input}\nA: ${translated.command} → ${result.stdout?.slice(0, 500) || ''}`, {
        role: 'assistant', type: 'command', command: translated.command,
      });
    } catch {}

    res.json({
      success: true,
      input,
      command: translated.command,
      description: translated.description,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration,
    });
  } catch (err) {
    res.json({
      success: false,
      input,
      command: translated.command,
      description: translated.description,
      error: err.message,
    });
  }
});

// Get quick actions (includes plugin actions)
router.get('/actions', (req, res) => {
  const pluginLoader = require('../services/pluginLoader');
  const pluginActions = pluginLoader.getPluginQuickActions();
  res.json([...QUICK_ACTIONS, ...pluginActions]);
});

// Chat history
router.get('/history', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(
    "SELECT * FROM command_history WHERE language = 'assistant' ORDER BY created_at DESC LIMIT 30"
  ).all();
  res.json(rows);
});

// Smart suggestions
router.get('/suggestions', (req, res) => {
  const db = req.app.locals.db;
  const suggestions = getSuggestions(db);
  res.json(suggestions);
});

// Execute user-approved AI-generated command
router.post('/execute-approved', async (req, res) => {
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: 'No command' });

  const db = req.app.locals.db;
  const startTime = Date.now();

  try {
    const result = await execCommand(command, { timeout: 30000 });
    const duration = Date.now() - startTime;

    try {
      db.prepare('INSERT INTO command_history (command, language, output, exit_code, duration_ms) VALUES (?, ?, ?, ?, ?)')
        .run(command, 'ai-assistant', (result.stdout + result.stderr).slice(0, 10000), result.exitCode, duration);
    } catch {}

    res.json({
      success: true,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      duration,
    });
  } catch (err) {
    res.json({ success: false, command, error: err.message });
  }
});

// Recent commands (for quick launcher)
router.get('/recent', (req, res) => {
  const db = req.app.locals.db;
  const rows = db.prepare(
    "SELECT DISTINCT command FROM command_history WHERE command IS NOT NULL AND command != '' ORDER BY created_at DESC LIMIT 10"
  ).all();
  res.json(rows.map(r => r.command));
});

function execCommand(cmd, opts = {}) {
  return new Promise((resolve) => {
    const proc = spawn('bash', ['-c', cmd], {
      cwd: opts.cwd || os.homedir(),
      timeout: opts.timeout || 30000,
      env: process.env,
    });

    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());

    const timer = setTimeout(() => {
      proc.kill('SIGKILL');
      stderr += '\n[TIMEOUT]';
    }, opts.timeout || 30000);

    proc.on('close', code => { clearTimeout(timer); resolve({ stdout, stderr, exitCode: code || 0 }); });
    proc.on('error', err => { clearTimeout(timer); resolve({ stdout, stderr: err.message, exitCode: 1 }); });
  });
}

module.exports = router;
