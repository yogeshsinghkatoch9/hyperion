import { describe, it, expect } from 'vitest';

const ssh = require('../services/ssh');

// ── Host Sanitization ──
describe('Host Sanitization', () => {
  it('allows valid hostname', () => {
    expect(ssh.sanitizeHost('example.com')).toBe('example.com');
  });
  it('allows IP address', () => {
    expect(ssh.sanitizeHost('192.168.1.1')).toBe('192.168.1.1');
  });
  it('strips shell chars', () => {
    expect(ssh.sanitizeHost('host;rm -rf')).toBe('hostrm-rf');
  });
  it('allows colons for IPv6', () => {
    expect(ssh.sanitizeHost('::1')).toBe('::1');
  });
});

// ── User Sanitization ──
describe('User Sanitization', () => {
  it('allows valid username', () => {
    expect(ssh.sanitizeUser('admin')).toBe('admin');
  });
  it('allows email-like user', () => {
    expect(ssh.sanitizeUser('user@host')).toBe('user@host');
  });
  it('strips dangerous chars', () => {
    expect(ssh.sanitizeUser('user;echo hack')).toBe('userechohack');
  });
});

// ── Path Sanitization ──
describe('Path Sanitization', () => {
  it('allows normal paths', () => {
    expect(ssh.sanitizePath('/home/user/file.txt')).toBe('/home/user/file.txt');
  });
  it('strips backticks', () => {
    expect(ssh.sanitizePath('path`cmd`')).toBe('pathcmd');
  });
  it('strips semicolons', () => {
    expect(ssh.sanitizePath('/tmp;rm -rf /')).toBe('/tmprm -rf /');
  });
});

// ── Port Sanitization ──
describe('Port Sanitization', () => {
  it('allows valid port', () => {
    expect(ssh.sanitizePort(22)).toBe(22);
  });
  it('defaults invalid port to 22', () => {
    expect(ssh.sanitizePort(-1)).toBe(22);
    expect(ssh.sanitizePort(99999)).toBe(22);
    expect(ssh.sanitizePort('abc')).toBe(22);
  });
  it('allows high ports', () => {
    expect(ssh.sanitizePort(65535)).toBe(65535);
  });
});

// ── SSH Args Builder ──
describe('SSH Args Builder', () => {
  it('builds basic args', () => {
    const args = ssh.buildSshArgs({ host: 'example.com', port: 22, username: 'admin', auth_type: 'key', key_path: '' });
    expect(args).toContain('-p');
    expect(args).toContain('22');
    expect(args[args.length - 1]).toBe('admin@example.com');
  });
  it('includes key path when provided', () => {
    const args = ssh.buildSshArgs({ host: 'h', port: 22, username: 'u', auth_type: 'key', key_path: '/path/to/key' });
    expect(args).toContain('-i');
    expect(args).toContain('/path/to/key');
  });
  it('skips key for non-key auth', () => {
    const args = ssh.buildSshArgs({ host: 'h', port: 22, username: 'u', auth_type: 'password', key_path: '/key' });
    expect(args).not.toContain('-i');
  });
});

// ── Module Exports ──
describe('Module Exports', () => {
  it('exports all expected functions', () => {
    const fns = [
      'sanitizeHost', 'sanitizeUser', 'sanitizePath', 'sanitizePort',
      'listConnections', 'getConnection', 'saveConnection', 'updateConnection', 'deleteConnection',
      'buildSshArgs', 'executeCommand', 'testConnection',
      'uploadFile', 'downloadFile', 'listRemoteFiles', 'getRemoteInfo',
      'getKnownHosts', 'listSshKeys',
    ];
    for (const fn of fns) {
      expect(typeof ssh[fn]).toBe('function');
    }
  });
});
