/**
 * Workflow Engine — conditional execution, loops, variables
 */
'use strict';
const { execSync } = require('child_process');
const os = require('os');
const { resolveAppName } = require('./appDiscovery');

const MAX_LOOP_ITERATIONS = 100;
const COMMAND_TIMEOUT = 10000;

// Sanitize user input for shell safety
function shellSafe(s) { return (s || '').replace(/[`$(){}|;&<>\\]/g, ''); }
function osascriptSafe(s) { return (s || '').replace(/["\\]/g, '').replace(/[`$]/g, ''); }

function evaluateCondition(actual, operator, expected) {
  const a = String(actual ?? '');
  const e = String(expected ?? '');
  switch (operator) {
    case 'eq': return a === e;
    case 'neq': return a !== e;
    case 'gt': return Number(a) > Number(e);
    case 'lt': return Number(a) < Number(e);
    case 'contains': return a.includes(e);
    case 'matches':
      try { return new RegExp(e).test(a); } catch { return false; }
    default: return false;
  }
}

function substituteVars(str, vars) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return vars[name] !== undefined ? String(vars[name]) : '';
  });
}

function executeAction(action, vars) {
  const appName = resolveAppName(shellSafe(action.app || ''));
  let cmd;

  if (action.type === 'open') {
    if (process.platform === 'darwin') {
      const safeArgs = shellSafe(action.args || '');
      cmd = safeArgs ? `open -a "${appName}" ${safeArgs}` : `open -a "${appName}"`;
    } else {
      cmd = `xdg-open "${appName}" 2>/dev/null`;
    }
  } else if (action.type === 'close') {
    cmd = process.platform === 'darwin'
      ? `osascript -e 'quit app "${osascriptSafe(appName)}"' 2>/dev/null`
      : `pkill -f "${shellSafe(appName)}" 2>/dev/null`;
  } else if (action.type === 'command') {
    cmd = substituteVars(shellSafe(action.command || 'echo "no command"'), vars);
  } else {
    cmd = 'echo "Unknown action type"';
  }

  try {
    const output = execSync(cmd, { encoding: 'utf8', timeout: COMMAND_TIMEOUT, cwd: os.homedir() });
    return { action: action.type, app: appName, status: 'ok', output: output.trim(), exitCode: 0 };
  } catch (err) {
    return { action: action.type, app: appName, status: 'error', output: err.message, exitCode: err.status || 1 };
  }
}

function execute(actions, context = {}) {
  const vars = { ...context };
  const results = [];

  function runActions(actionList) {
    for (let idx = 0; idx < actionList.length; idx++) {
      const action = actionList[idx];

      if (action.type === 'condition') {
        const fieldValue = vars[action.field] !== undefined ? vars[action.field] : '';
        const matched = evaluateCondition(fieldValue, action.operator, action.value);
        const branch = matched ? (action.then || []) : (action.else || []);
        runActions(branch);
        continue;
      }

      if (action.type === 'loop') {
        const count = Math.min(parseInt(action.count) || 0, MAX_LOOP_ITERATIONS);
        const varName = action.variable || 'i';
        for (let i = 0; i < count; i++) {
          vars[varName] = i;
          runActions(action.actions || []);
        }
        continue;
      }

      if (action.type === 'set_variable') {
        vars[action.name] = substituteVars(action.value || '', vars);
        results.push({ action: 'set_variable', status: 'ok', output: `${action.name}=${vars[action.name]}` });
        continue;
      }

      // Standard action (open/close/command)
      const result = executeAction(action, vars);
      results.push(result);

      // Store outputs for variable substitution
      const stepKey = `step_${results.length - 1}`;
      vars[`${stepKey}_output`] = result.output;
      vars[`${stepKey}_exitCode`] = result.exitCode !== undefined ? result.exitCode : (result.status === 'ok' ? 0 : 1);
    }
  }

  runActions(actions);
  return { results, variables: vars };
}

module.exports = { execute, evaluateCondition, substituteVars, MAX_LOOP_ITERATIONS };
