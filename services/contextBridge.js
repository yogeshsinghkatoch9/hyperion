/**
 * Hyperion Context Bridge — Aggregates all system data into AI-ready context
 * Packages monitor, docker, health, cron, metrics, logs into a single snapshot
 * Each section wrapped in try/catch so one failure doesn't crash the whole thing
 */
const os = require('os');
const { execSync } = require('child_process');

const monitorSvc = require('./monitor');
const dockerSvc = require('./docker');
const healthCheck = require('./healthCheck');
const cronSvc = require('./cron');
const metricsSvc = require('./metricsService');
const logViewer = require('./logViewer');

// ═══ RUNTIME DETECTION ═══

function detectRuntimes() {
  const runtimes = [
    { name: 'Node.js', cmd: 'node --version' },
    { name: 'Python', cmd: 'python3 --version 2>&1 || python --version 2>&1' },
    { name: 'Go', cmd: 'go version' },
    { name: 'Ruby', cmd: 'ruby --version' },
    { name: 'Java', cmd: 'java --version 2>&1 | head -1' },
    { name: 'Rust', cmd: 'rustc --version' },
    { name: 'Docker', cmd: 'docker --version' },
    { name: 'Docker Compose', cmd: 'docker compose version 2>/dev/null || docker-compose --version 2>/dev/null' },
  ];

  return runtimes.map(r => {
    try {
      const out = execSync(r.cmd, { encoding: 'utf8', timeout: 3000 }).trim();
      const verMatch = out.match(/(\d+\.\d+[\.\d]*)/);
      return { name: r.name, version: verMatch ? verMatch[1] : out.split('\n')[0], installed: true };
    } catch {
      return { name: r.name, version: null, installed: false };
    }
  });
}

// ═══ RECENT ERRORS ═══

function getRecentErrors() {
  const paths = logViewer.getCommonLogPaths();
  const errors = [];

  for (const dir of paths.slice(0, 3)) {
    try {
      const files = logViewer.findLogFiles(dir, { maxDepth: 2 });
      for (const f of files.slice(0, 5)) {
        try {
          const result = logViewer.readLogFile(f.path, { lines: 100, level: 'error' });
          for (const line of result.lines.slice(-5)) {
            errors.push({ text: line.text.slice(0, 200), level: line.level, source: f.name });
          }
        } catch {}
      }
      if (errors.length >= 10) break;
    } catch {}
  }

  return errors.slice(0, 10);
}

// ═══ MAIN CONTEXT GENERATOR ═══

async function generateContext(db, opts = {}) {
  const ctx = { generatedAt: new Date().toISOString() };

  // System
  let system = null;
  try {
    if (opts.sections ? opts.sections.includes('system') : opts.system !== false) {
      const snap = monitorSvc.getFullSnapshot();
      system = {
        hostname: snap.hostname,
        platform: snap.platform,
        arch: snap.arch,
        uptime: snap.uptime,
        uptimeFormatted: snap.uptimeFormatted,
        cpuCount: snap.cpuCount,
        cpuModel: snap.cpuModel,
        loadAvg: snap.loadAvg,
        totalMemMB: snap.totalMemMB,
        freeMemMB: snap.freeMemMB,
        usedMemMB: snap.usedMemMB,
        memPercent: snap.memPercent,
        disks: snap.disks,
      };
    }
  } catch (e) { system = { error: e.message }; }
  ctx.system = system;

  // Docker
  let docker = null;
  try {
    if (opts.sections ? opts.sections.includes('docker') : opts.docker !== false) {
      if (dockerSvc.isDockerAvailable()) {
        const version = dockerSvc.getDockerVersion();
        const info = dockerSvc.getDockerInfo();
        const containers = dockerSvc.listContainers(true).map(c => ({
          name: c.name, image: c.image, state: c.state, status: c.status,
          ports: typeof c.ports === 'string' ? c.ports : (c.ports || []).map(p => p.hostPort || p.containerPort || p.raw).filter(Boolean).join(', '),
        }));
        docker = { available: true, version, info, containers };
      } else {
        docker = { available: false };
      }
    }
  } catch { docker = { available: false, error: 'Docker unavailable' }; }
  ctx.docker = docker;

  // Processes
  let processes = null;
  try {
    if (opts.sections ? opts.sections.includes('processes') : opts.processes !== false) {
      const summary = monitorSvc.getProcessSummary();
      processes = {
        total: summary.total,
        totalCpu: summary.totalCpu,
        topCpu: summary.topCpu,
        topMem: summary.topMem,
      };
    }
  } catch (e) { processes = { error: e.message }; }
  ctx.processes = processes;

  // Network
  let network = null;
  try {
    if (opts.sections ? opts.sections.includes('network') : opts.network !== false) {
      const ports = monitorSvc.getListeningPorts();
      const summary = monitorSvc.getNetworkSummary();
      network = { listeningPorts: ports, summary };
    }
  } catch (e) { network = { error: e.message }; }
  ctx.network = network;

  // Health
  let health = null;
  try {
    if (opts.sections ? opts.sections.includes('health') : opts.health !== false) {
      if (db) {
        const result = healthCheck.runChecks(db);
        health = { status: result.status, checks: result.checks };
      }
    }
  } catch (e) { health = { error: e.message }; }
  ctx.health = health;

  // Cron
  let cron = null;
  try {
    if (opts.sections ? opts.sections.includes('cron') : opts.cron !== false) {
      const jobs = cronSvc.listCrontab().filter(j => j.type === 'job');
      cron = {
        jobs: jobs.map(j => ({
          schedule: j.schedule,
          command: j.command,
          description: j.description,
        })),
      };
    }
  } catch (e) { cron = { error: e.message }; }
  ctx.cron = cron;

  // Metrics
  let metrics = null;
  try {
    if (opts.sections ? opts.sections.includes('metrics') : opts.metrics !== false) {
      const m = metricsSvc.getMetrics();
      metrics = {
        requests: {
          total: m.requests.total,
          avgDuration: m.requests.avgDuration,
          p95Duration: m.requests.p95Duration,
        },
      };
    }
  } catch (e) { metrics = { error: e.message }; }
  ctx.metrics = metrics;

  // Runtimes
  let runtimes = null;
  try {
    if (opts.sections ? opts.sections.includes('runtimes') : opts.runtimes !== false) {
      runtimes = detectRuntimes();
    }
  } catch (e) { runtimes = { error: e.message }; }
  ctx.runtimes = runtimes;

  // Recent errors
  let recentErrors = null;
  try {
    if (opts.sections ? opts.sections.includes('errors') : opts.errors !== false) {
      recentErrors = getRecentErrors();
    }
  } catch (e) { recentErrors = { error: e.message }; }
  ctx.recentErrors = recentErrors;

  return ctx;
}

// ═══ MARKDOWN FORMATTER ═══

function formatAsMarkdown(ctx) {
  const lines = [];
  const hostname = ctx.system?.hostname || os.hostname();

  lines.push(`# Server Context — ${hostname}`);
  lines.push(`Generated: ${ctx.generatedAt}`);
  lines.push('');

  // System
  if (ctx.system && !ctx.system.error) {
    lines.push('## System');
    lines.push(`- **Host**: ${ctx.system.hostname} (${ctx.system.platform} ${ctx.system.arch}) — Up ${ctx.system.uptimeFormatted}`);
    lines.push(`- **CPU**: ${ctx.system.cpuCount} cores — ${ctx.system.cpuModel || 'unknown'} — Load: ${(ctx.system.loadAvg || []).map(l => l.toFixed(2)).join(' / ')}`);
    lines.push(`- **Memory**: ${(ctx.system.usedMemMB || 0).toLocaleString()} / ${(ctx.system.totalMemMB || 0).toLocaleString()} MB (${ctx.system.memPercent}%)`);
    lines.push('');

    // Disks
    if (ctx.system.disks && ctx.system.disks.length > 0) {
      lines.push('## Disk');
      lines.push('| Mount | Size | Used | Free | Use% |');
      lines.push('|-------|------|------|------|------|');
      for (const d of ctx.system.disks) {
        lines.push(`| ${d.mountpoint} | ${d.size} | ${d.used} | ${d.available} | ${d.usePercent}% |`);
      }
      lines.push('');
    }
  }

  // Health
  if (ctx.health && !ctx.health.error) {
    const checks = ctx.health.checks || {};
    const parts = Object.entries(checks).map(([k, v]) => {
      const val = v.latency ? `(${v.latency}ms)` : v.avgLatency ? `(${v.avgLatency}ms avg)` : '';
      return `${k}: ${v.status} ${val}`.trim();
    });
    lines.push(`## Health: ${ctx.health.status}`);
    lines.push(`- ${parts.join(' | ')}`);
    lines.push('');
  }

  // Docker
  if (ctx.docker && ctx.docker.available && ctx.docker.containers) {
    lines.push(`## Docker (${ctx.docker.containers.length} containers)`);
    lines.push('| Name | Image | State | Ports |');
    lines.push('|------|-------|-------|-------|');
    for (const c of ctx.docker.containers) {
      lines.push(`| ${c.name} | ${c.image} | ${c.state} | ${c.ports || '—'} |`);
    }
    lines.push('');
  } else if (ctx.docker && !ctx.docker.available) {
    lines.push('## Docker');
    lines.push('- Docker not available');
    lines.push('');
  }

  // Listening ports
  if (ctx.network && ctx.network.listeningPorts && ctx.network.listeningPorts.length > 0) {
    lines.push('## Listening Ports');
    lines.push('| Port | Process |');
    lines.push('|------|---------|');
    for (const p of ctx.network.listeningPorts.slice(0, 20)) {
      lines.push(`| ${p.port} | ${p.command} |`);
    }
    lines.push('');
  }

  // Processes
  if (ctx.processes && !ctx.processes.error && ctx.processes.topCpu) {
    lines.push(`## Top Processes (CPU) — ${ctx.processes.total} total`);
    lines.push('| PID | Name | CPU% | Mem MB |');
    lines.push('|-----|------|------|--------|');
    for (const p of ctx.processes.topCpu) {
      lines.push(`| ${p.pid} | ${p.name} | ${p.cpu} | ${p.rssMB} |`);
    }
    lines.push('');
  }

  // Cron
  if (ctx.cron && ctx.cron.jobs && ctx.cron.jobs.length > 0) {
    lines.push(`## Cron Jobs (${ctx.cron.jobs.length})`);
    lines.push('| Schedule | Command | Description |');
    lines.push('|----------|---------|-------------|');
    for (const j of ctx.cron.jobs) {
      lines.push(`| ${j.schedule} | ${j.command} | ${j.description} |`);
    }
    lines.push('');
  }

  // Metrics
  if (ctx.metrics && ctx.metrics.requests) {
    lines.push('## API Metrics');
    lines.push(`- **Total requests**: ${ctx.metrics.requests.total} — Avg: ${ctx.metrics.requests.avgDuration}ms — P95: ${Math.round(ctx.metrics.requests.p95Duration)}ms`);
    lines.push('');
  }

  // Runtimes
  if (ctx.runtimes && Array.isArray(ctx.runtimes)) {
    const installed = ctx.runtimes.filter(r => r.installed);
    if (installed.length > 0) {
      lines.push('## Installed Runtimes');
      lines.push(installed.map(r => `- **${r.name}**: ${r.version}`).join('\n'));
      lines.push('');
    }
  }

  // Recent errors
  if (ctx.recentErrors && Array.isArray(ctx.recentErrors) && ctx.recentErrors.length > 0) {
    lines.push('## Recent Errors');
    for (const e of ctx.recentErrors) {
      lines.push(`- [${(e.level || 'ERROR').toUpperCase()}] ${e.source ? e.source + ': ' : ''}${e.text}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ═══ COMPACT FORMAT (~500 tokens) ═══

function formatCompact(ctx) {
  const lines = [];
  const hostname = ctx.system?.hostname || os.hostname();

  lines.push(`# ${hostname} — ${ctx.generatedAt}`);

  if (ctx.system && !ctx.system.error) {
    lines.push(`OS: ${ctx.system.platform} ${ctx.system.arch} | Up: ${ctx.system.uptimeFormatted} | CPU: ${ctx.system.cpuCount}c load ${(ctx.system.loadAvg || [])[0]?.toFixed(1)} | Mem: ${ctx.system.memPercent}% (${ctx.system.usedMemMB}/${ctx.system.totalMemMB}MB)`);
  }

  if (ctx.health && !ctx.health.error) {
    lines.push(`Health: ${ctx.health.status}`);
  }

  if (ctx.docker && ctx.docker.available && ctx.docker.containers) {
    const running = ctx.docker.containers.filter(c => c.state === 'running').length;
    const stopped = ctx.docker.containers.length - running;
    lines.push(`Docker: ${running} running, ${stopped} stopped`);
    const unhealthy = ctx.docker.containers.filter(c => c.state !== 'running');
    if (unhealthy.length > 0) {
      lines.push(`  Down: ${unhealthy.map(c => `${c.name} (${c.state})`).join(', ')}`);
    }
  }

  if (ctx.system?.disks) {
    const highUse = ctx.system.disks.filter(d => d.usePercent > 80);
    if (highUse.length > 0) {
      lines.push(`Disk warning: ${highUse.map(d => `${d.mountpoint} ${d.usePercent}%`).join(', ')}`);
    }
  }

  if (ctx.network?.listeningPorts) {
    lines.push(`Ports: ${ctx.network.listeningPorts.slice(0, 10).map(p => `${p.port}/${p.command}`).join(', ')}`);
  }

  if (ctx.recentErrors && ctx.recentErrors.length > 0) {
    lines.push(`Errors (${ctx.recentErrors.length}): ${ctx.recentErrors.slice(0, 3).map(e => e.text.slice(0, 60)).join(' | ')}`);
  }

  return lines.join('\n');
}

// ═══ TOKEN ESTIMATOR ═══

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

module.exports = { generateContext, formatAsMarkdown, formatCompact, estimateTokens };
