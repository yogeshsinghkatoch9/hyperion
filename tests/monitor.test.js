import { describe, it, expect } from 'vitest';

const monitor = require('../services/monitor');

// ── Process Tests ──
describe('Process Manager', () => {
  it('getProcesses returns array of process objects', () => {
    const procs = monitor.getProcesses();
    expect(Array.isArray(procs)).toBe(true);
    expect(procs.length).toBeGreaterThan(0);

    const first = procs[0];
    expect(first).toHaveProperty('pid');
    expect(first).toHaveProperty('ppid');
    expect(first).toHaveProperty('user');
    expect(first).toHaveProperty('cpu');
    expect(first).toHaveProperty('mem');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('command');
    expect(first).toHaveProperty('rssMB');
    expect(typeof first.pid).toBe('number');
    expect(typeof first.cpu).toBe('number');
  });

  it('processes are sorted by CPU descending', () => {
    const procs = monitor.getProcesses();
    for (let i = 1; i < Math.min(procs.length, 10); i++) {
      expect(procs[i - 1].cpu).toBeGreaterThanOrEqual(procs[i].cpu);
    }
  });

  it('getProcessTree returns tree with children arrays', () => {
    const tree = monitor.getProcessTree();
    expect(Array.isArray(tree)).toBe(true);
    expect(tree.length).toBeGreaterThan(0);

    const root = tree[0];
    expect(root).toHaveProperty('children');
    expect(Array.isArray(root.children)).toBe(true);
  });

  it('getProcessSummary returns aggregate stats', () => {
    const summary = monitor.getProcessSummary();
    expect(summary.total).toBeGreaterThan(0);
    expect(typeof summary.totalCpu).toBe('number');
    expect(typeof summary.totalMemMB).toBe('number');
    expect(summary.cpuCount).toBeGreaterThan(0);
    expect(summary.topCpu.length).toBeLessThanOrEqual(5);
    expect(summary.topMem.length).toBeLessThanOrEqual(5);
    expect(typeof summary.byUser).toBe('object');
  });

  it('searchProcesses filters by query', () => {
    const results = monitor.searchProcesses('node');
    expect(Array.isArray(results)).toBe(true);
    // The vitest node process should match
    const hasNode = results.some(p => p.name.toLowerCase().includes('node') || p.command.toLowerCase().includes('node'));
    expect(hasNode).toBe(true);
  });

  it('killProcess rejects PID 0 and 1', () => {
    expect(() => monitor.killProcess(0)).toThrow();
    expect(() => monitor.killProcess(1)).toThrow();
  });

  it('killProcess rejects killing self', () => {
    expect(() => monitor.killProcess(process.pid)).toThrow('Cannot kill Hyperion');
  });
});

// ── Network Tests ──
describe('Network Monitor', () => {
  it('getNetworkConnections returns array', () => {
    const conns = monitor.getNetworkConnections();
    expect(Array.isArray(conns)).toBe(true);
    // There should be at least some connections on any running system
  });

  it('connection objects have required fields', () => {
    const conns = monitor.getNetworkConnections();
    if (conns.length > 0) {
      const c = conns[0];
      expect(c).toHaveProperty('command');
      expect(c).toHaveProperty('pid');
      expect(c).toHaveProperty('state');
    }
  });

  it('getListeningPorts returns sorted array', () => {
    const ports = monitor.getListeningPorts();
    expect(Array.isArray(ports)).toBe(true);
    if (ports.length > 1) {
      expect(ports[0].port).toBeLessThanOrEqual(ports[1].port);
    }
  });

  it('getNetworkSummary returns structured summary', () => {
    const summary = monitor.getNetworkSummary();
    expect(typeof summary.total).toBe('number');
    expect(typeof summary.listening).toBe('number');
    expect(typeof summary.established).toBe('number');
    expect(typeof summary.byRemote).toBe('object');
  });
});

// ── Port Scanner Tests ──
describe('Port Scanner', () => {
  it('scanPorts returns structured result', async () => {
    // Scan just port 80 on localhost — fast test
    const result = await monitor.scanPorts('127.0.0.1', '80-80', 200);
    expect(result).toHaveProperty('host', '127.0.0.1');
    expect(result).toHaveProperty('range', '80-80');
    expect(result).toHaveProperty('scanned', 1);
    expect(Array.isArray(result.openPorts)).toBe(true);
  });

  it('scanPorts limits range to prevent abuse', async () => {
    const result = await monitor.scanPorts('127.0.0.1', '1-2000', 100);
    // Should cap at start + 1023
    expect(result.scanned).toBeLessThanOrEqual(1024);
  });

  it('open ports include service labels', async () => {
    // Scan a range that might have common ports
    const result = await monitor.scanPorts('127.0.0.1', '22-22', 200);
    if (result.openPorts.length > 0) {
      expect(result.openPorts[0]).toHaveProperty('service');
    }
  });
});

// ── Disk Tests ──
describe('Disk Analyzer', () => {
  it('getDiskInfo returns filesystem info', () => {
    const disks = monitor.getDiskInfo();
    expect(Array.isArray(disks)).toBe(true);
    expect(disks.length).toBeGreaterThan(0);

    const d = disks[0];
    expect(d).toHaveProperty('filesystem');
    expect(d).toHaveProperty('size');
    expect(d).toHaveProperty('used');
    expect(d).toHaveProperty('available');
    expect(d).toHaveProperty('usePercent');
    expect(d).toHaveProperty('mountpoint');
    expect(typeof d.usePercent).toBe('number');
  });

  it('getDiskUsage returns directory entries', () => {
    const usage = monitor.getDiskUsage('/tmp', 1);
    expect(usage).toHaveProperty('basePath', '/tmp');
    expect(Array.isArray(usage.entries)).toBe(true);
  });

  it('getLargestFiles returns file list', () => {
    const files = monitor.getLargestFiles('/tmp', 5);
    expect(Array.isArray(files)).toBe(true);
    if (files.length > 0) {
      expect(files[0]).toHaveProperty('size');
      expect(files[0]).toHaveProperty('path');
      expect(files[0]).toHaveProperty('name');
    }
  });
});

// ── Alert Tests ──
describe('Alert Engine', () => {
  it('getAlertConfig returns thresholds', () => {
    const config = monitor.getAlertConfig();
    expect(config).toHaveProperty('cpuWarn');
    expect(config).toHaveProperty('cpuCrit');
    expect(config).toHaveProperty('memWarn');
    expect(config).toHaveProperty('memCrit');
    expect(config).toHaveProperty('diskWarn');
    expect(config).toHaveProperty('diskCrit');
    expect(config).toHaveProperty('enabled');
  });

  it('setAlertConfig updates thresholds', () => {
    const original = monitor.getAlertConfig();
    monitor.setAlertConfig({ cpuWarn: 70, memWarn: 300 });
    const updated = monitor.getAlertConfig();
    expect(updated.cpuWarn).toBe(70);
    expect(updated.memWarn).toBe(300);
    // Restore
    monitor.setAlertConfig(original);
  });

  it('checkAlerts returns array (without DB)', () => {
    const alerts = monitor.checkAlerts(null);
    expect(Array.isArray(alerts)).toBe(true);
    // Each alert should have level, category, message
    for (const a of alerts) {
      expect(a).toHaveProperty('level');
      expect(a).toHaveProperty('category');
      expect(a).toHaveProperty('message');
      expect(['warning', 'critical']).toContain(a.level);
    }
  });
});

// ── Overview Tests ──
describe('System Overview', () => {
  it('getFullSnapshot returns comprehensive data', () => {
    const snap = monitor.getFullSnapshot();
    expect(snap).toHaveProperty('hostname');
    expect(snap).toHaveProperty('platform');
    expect(snap).toHaveProperty('arch');
    expect(snap).toHaveProperty('uptime');
    expect(snap).toHaveProperty('uptimeFormatted');
    expect(snap).toHaveProperty('cpuCount');
    expect(snap).toHaveProperty('loadAvg');
    expect(snap).toHaveProperty('totalMemMB');
    expect(snap).toHaveProperty('freeMemMB');
    expect(snap).toHaveProperty('usedMemMB');
    expect(snap).toHaveProperty('memPercent');
    expect(snap).toHaveProperty('processes');
    expect(snap).toHaveProperty('disks');
    expect(snap).toHaveProperty('timestamp');
    expect(snap.cpuCount).toBeGreaterThan(0);
    expect(snap.totalMemMB).toBeGreaterThan(0);
  });

  it('formatUptime handles various durations', () => {
    expect(monitor.formatUptime(30)).toBe('0m');
    expect(monitor.formatUptime(3600)).toBe('1h 0m');
    expect(monitor.formatUptime(90061)).toBe('1d 1h 1m');
    expect(monitor.formatUptime(7200)).toBe('2h 0m');
  });
});

// ── WebSocket Protocol Tests ──
describe('Monitor WebSocket Protocol', () => {
  it('monitor_snapshot message format', () => {
    const msg = { type: 'monitor_snapshot', data: monitor.getFullSnapshot() };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.type).toBe('monitor_snapshot');
    expect(parsed.data).toHaveProperty('hostname');
    expect(parsed.data).toHaveProperty('processes');
  });
});
