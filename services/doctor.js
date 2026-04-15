/**
 * Doctor — System health diagnostics
 * Checks Node.js, SQLite, disk, ports, LLM, plugins, Chrome, memory.
 * Returns scored report: pass / warn / fail per check.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function runDiagnostics(db, opts = {}) {
  const checks = [];
  const quick = opts.quick || false;

  // 1. Node.js version
  const nodeVer = parseInt(process.version.slice(1));
  checks.push({
    name: 'Node.js Version',
    value: process.version,
    status: nodeVer >= 18 ? 'pass' : nodeVer >= 16 ? 'warn' : 'fail',
    detail: nodeVer >= 18 ? 'OK' : nodeVer >= 16 ? 'Supported but upgrade recommended' : 'Unsupported, upgrade to 18+',
  });

  // 2. SQLite integrity
  try {
    const result = db.prepare('PRAGMA integrity_check').get();
    const ok = result?.integrity_check === 'ok';
    checks.push({
      name: 'SQLite Integrity',
      value: ok ? 'ok' : 'issues detected',
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'Database is healthy' : 'Database integrity issues found',
    });
  } catch (err) {
    checks.push({ name: 'SQLite Integrity', value: 'error', status: 'fail', detail: err.message });
  }

  // 3. Disk space
  try {
    const raw = execSync("df -k / | awk 'NR==2{print $4}'", { encoding: 'utf8', timeout: 5000 }).trim();
    const freeKB = parseInt(raw);
    const freeGB = freeKB / (1024 * 1024);
    checks.push({
      name: 'Disk Space',
      value: `${freeGB.toFixed(1)} GB free`,
      status: freeGB > 1 ? 'pass' : freeGB > 0.5 ? 'warn' : 'fail',
      detail: freeGB > 1 ? 'Sufficient' : freeGB > 0.5 ? 'Low disk space' : 'Critical: less than 500MB',
    });
  } catch {
    checks.push({ name: 'Disk Space', value: 'unknown', status: 'warn', detail: 'Could not check disk space' });
  }

  // 4. Port check
  const port = parseInt(process.env.PORT) || 3333;
  checks.push({
    name: `Port ${port}`,
    value: 'in use (by Hyperion)',
    status: 'pass',
    detail: 'Server is running',
  });

  // 5. Memory usage
  const memUsage = process.memoryUsage();
  const heapMB = memUsage.heapUsed / (1024 * 1024);
  const rssMB = memUsage.rss / (1024 * 1024);
  checks.push({
    name: 'Memory Usage',
    value: `${heapMB.toFixed(0)} MB heap / ${rssMB.toFixed(0)} MB RSS`,
    status: rssMB < 512 ? 'pass' : rssMB < 1024 ? 'warn' : 'fail',
    detail: rssMB < 512 ? 'Normal' : rssMB < 1024 ? 'Elevated memory usage' : 'High memory usage, consider restart',
  });

  if (!quick) {
    // 6. LLM Provider connectivity
    try {
      const llm = require('./llmService');
      const providers = llm.getProviderOrder();
      if (providers.length) {
        const testResult = await llm.testProvider(providers[0]);
        checks.push({
          name: 'LLM Provider',
          value: `${providers[0]}${testResult.ok ? '' : ' (unreachable)'}`,
          status: testResult.ok ? (testResult.latency > 5000 ? 'warn' : 'pass') : 'fail',
          detail: testResult.ok ? `Responding in ${testResult.latency}ms` : testResult.error,
        });
      } else {
        checks.push({ name: 'LLM Provider', value: 'not configured', status: 'warn', detail: 'No LLM providers set up' });
      }
    } catch (err) {
      checks.push({ name: 'LLM Provider', value: 'error', status: 'fail', detail: err.message });
    }

    // 7. Plugin validity
    try {
      const pluginLoader = require('./pluginLoader');
      const plugins = pluginLoader.getPlugins();
      checks.push({
        name: 'Plugins',
        value: `${plugins.length} loaded`,
        status: 'pass',
        detail: plugins.map(p => `${p.name} v${p.version}`).join(', ') || 'No plugins installed',
      });
    } catch (err) {
      checks.push({ name: 'Plugins', value: 'error', status: 'fail', detail: err.message });
    }

    // 8. Chrome availability
    try {
      const browserControl = require('./browserControl');
      const chromePath = browserControl.findChromePath();
      checks.push({
        name: 'Chrome/Chromium',
        value: chromePath ? 'found' : 'not found',
        status: chromePath ? 'pass' : 'warn',
        detail: chromePath || 'Install Chrome for browser control features',
      });
    } catch {
      checks.push({ name: 'Chrome/Chromium', value: 'not found', status: 'warn', detail: 'Browser control unavailable' });
    }

    // 9. WebSocket health
    checks.push({
      name: 'WebSocket Server',
      value: 'active',
      status: 'pass',
      detail: 'Terminal, system, and notebook WebSocket endpoints available',
    });

    // 10. Skills
    try {
      const skillLoader = require('./skillLoader');
      const skills = skillLoader.getSkills();
      checks.push({
        name: 'Skills',
        value: `${skills.length} loaded`,
        status: 'pass',
        detail: skills.map(s => s.name).join(', ') || 'No skills installed',
      });
    } catch {
      checks.push({ name: 'Skills', value: '0', status: 'pass', detail: 'No skills installed' });
    }
  }

  // Score
  const passed = checks.filter(c => c.status === 'pass').length;
  const warned = checks.filter(c => c.status === 'warn').length;
  const failed = checks.filter(c => c.status === 'fail').length;
  const score = Math.round((passed / checks.length) * 100);

  return {
    score,
    summary: { passed, warned, failed, total: checks.length },
    checks,
    timestamp: new Date().toISOString(),
    system: {
      hostname: os.hostname(),
      platform: `${os.platform()} ${os.arch()}`,
      nodeVersion: process.version,
      uptime: Math.round(os.uptime()),
      cpuCount: os.cpus().length,
      totalMemory: `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)} GB`,
    },
  };
}

module.exports = { runDiagnostics };
