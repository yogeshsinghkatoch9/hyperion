import { describe, it, expect } from 'vitest';

const docker = require('../services/docker');

// ── Port Parsing ──
describe('Port Parsing', () => {
  it('parses host:port->container/protocol format', () => {
    const ports = docker.parsePorts('0.0.0.0:8080->80/tcp');
    expect(ports).toHaveLength(1);
    expect(ports[0].host).toBe('0.0.0.0');
    expect(ports[0].hostPort).toBe(8080);
    expect(ports[0].containerPort).toBe(80);
    expect(ports[0].protocol).toBe('tcp');
  });

  it('parses multiple ports', () => {
    const ports = docker.parsePorts('0.0.0.0:8080->80/tcp, 0.0.0.0:443->443/tcp');
    expect(ports).toHaveLength(2);
    expect(ports[0].hostPort).toBe(8080);
    expect(ports[1].hostPort).toBe(443);
  });

  it('parses exposed-only ports (no host mapping)', () => {
    const ports = docker.parsePorts('3000/tcp');
    expect(ports).toHaveLength(1);
    expect(ports[0].containerPort).toBe(3000);
    expect(ports[0].protocol).toBe('tcp');
  });

  it('parses UDP ports', () => {
    const ports = docker.parsePorts('0.0.0.0:53->53/udp');
    expect(ports[0].protocol).toBe('udp');
  });

  it('handles empty string', () => {
    expect(docker.parsePorts('')).toEqual([]);
  });

  it('handles null/undefined', () => {
    expect(docker.parsePorts(null)).toEqual([]);
    expect(docker.parsePorts(undefined)).toEqual([]);
  });

  it('handles mixed mapped and exposed ports', () => {
    const ports = docker.parsePorts('0.0.0.0:80->80/tcp, 443/tcp');
    expect(ports).toHaveLength(2);
    expect(ports[0].hostPort).toBe(80);
    expect(ports[1].containerPort).toBe(443);
    expect(ports[1].hostPort).toBeUndefined();
  });
});

// ── ID Sanitization ──
describe('ID Sanitization', () => {
  it('allows normal container IDs', () => {
    expect(docker.sanitizeId('abc123def456')).toBe('abc123def456');
  });

  it('allows container names with dashes and underscores', () => {
    expect(docker.sanitizeId('my-container_1')).toBe('my-container_1');
  });

  it('allows image names with colons and slashes', () => {
    expect(docker.sanitizeId('nginx:latest')).toBe('nginx:latest');
    expect(docker.sanitizeId('registry.io/myapp:v1.2')).toBe('registry.io/myapp:v1.2');
  });

  it('strips dangerous characters', () => {
    expect(docker.sanitizeId('container;rm -rf /')).toBe('containerrm-rf/');
  });

  it('strips backticks and dollar signs', () => {
    expect(docker.sanitizeId('test`whoami`')).toBe('testwhoami');
    expect(docker.sanitizeId('test$HOME')).toBe('testHOME');
  });

  it('strips spaces', () => {
    expect(docker.sanitizeId('my container')).toBe('mycontainer');
  });
});

// ── Image Name Sanitization ──
describe('Image Sanitization', () => {
  it('allows standard image names', () => {
    expect(docker.sanitizeImage('nginx:latest')).toBe('nginx:latest');
    expect(docker.sanitizeImage('ubuntu:22.04')).toBe('ubuntu:22.04');
  });

  it('allows registry paths', () => {
    expect(docker.sanitizeImage('ghcr.io/owner/repo:tag')).toBe('ghcr.io/owner/repo:tag');
  });

  it('allows digest references', () => {
    expect(docker.sanitizeImage('nginx@sha256:abc123')).toBe('nginx@sha256:abc123');
  });

  it('strips dangerous characters', () => {
    // sanitizeImage allows spaces but strips semicolons
    expect(docker.sanitizeImage('nginx;rm -rf')).toBe('nginxrm -rf');
  });
});

// ── Format Bytes ──
describe('Format Bytes', () => {
  it('formats zero', () => {
    expect(docker.formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(docker.formatBytes(500)).toBe('500.0 B');
  });

  it('formats kilobytes', () => {
    expect(docker.formatBytes(1024)).toBe('1.0 KB');
  });

  it('formats megabytes', () => {
    expect(docker.formatBytes(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(docker.formatBytes(1073741824)).toBe('1.0 GB');
  });

  it('handles NaN', () => {
    expect(docker.formatBytes(NaN)).toBe('0 B');
  });

  it('handles null', () => {
    expect(docker.formatBytes(null)).toBe('0 B');
  });
});

// ── State Color Mapping ──
describe('State Color', () => {
  it('returns green for running', () => {
    expect(docker.parseStateColor('running')).toBe('green');
  });

  it('returns red for exited', () => {
    expect(docker.parseStateColor('exited')).toBe('red');
  });

  it('returns red for dead', () => {
    expect(docker.parseStateColor('dead')).toBe('red');
  });

  it('returns amber for paused', () => {
    expect(docker.parseStateColor('paused')).toBe('amber');
  });

  it('returns cyan for created', () => {
    expect(docker.parseStateColor('created')).toBe('cyan');
  });

  it('returns cyan for restarting', () => {
    expect(docker.parseStateColor('restarting')).toBe('cyan');
  });

  it('is case insensitive', () => {
    expect(docker.parseStateColor('Running')).toBe('green');
    expect(docker.parseStateColor('EXITED')).toBe('red');
  });

  it('returns dim for unknown', () => {
    expect(docker.parseStateColor('unknown')).toBe('dim');
  });

  it('handles null/undefined', () => {
    expect(docker.parseStateColor(null)).toBe('dim');
    expect(docker.parseStateColor(undefined)).toBe('dim');
  });
});

// ── Exports ──
describe('Module Exports', () => {
  it('exports all expected functions', () => {
    expect(typeof docker.isDockerAvailable).toBe('function');
    expect(typeof docker.getDockerVersion).toBe('function');
    expect(typeof docker.getDockerInfo).toBe('function');
    expect(typeof docker.listContainers).toBe('function');
    expect(typeof docker.inspectContainer).toBe('function');
    expect(typeof docker.startContainer).toBe('function');
    expect(typeof docker.stopContainer).toBe('function');
    expect(typeof docker.restartContainer).toBe('function');
    expect(typeof docker.pauseContainer).toBe('function');
    expect(typeof docker.unpauseContainer).toBe('function');
    expect(typeof docker.removeContainer).toBe('function');
    expect(typeof docker.getContainerLogs).toBe('function');
    expect(typeof docker.getContainerStats).toBe('function');
    expect(typeof docker.getAllStats).toBe('function');
    expect(typeof docker.listImages).toBe('function');
    expect(typeof docker.pullImage).toBe('function');
    expect(typeof docker.removeImage).toBe('function');
    expect(typeof docker.pruneImages).toBe('function');
    expect(typeof docker.listVolumes).toBe('function');
    expect(typeof docker.inspectVolume).toBe('function');
    expect(typeof docker.removeVolume).toBe('function');
    expect(typeof docker.pruneVolumes).toBe('function');
    expect(typeof docker.listNetworks).toBe('function');
    expect(typeof docker.composeUp).toBe('function');
    expect(typeof docker.composeDown).toBe('function');
    expect(typeof docker.composePs).toBe('function');
    expect(typeof docker.streamLogs).toBe('function');
  });
});
