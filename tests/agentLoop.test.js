import { describe, it, expect } from 'vitest';

const {
  TOOLS,
  needsApproval,
  executors,
  isCmdBlocked,
  resolveSafePath,
  isPathSafe,
} = require('../services/agentLoop');

describe('Agent Loop', () => {
  describe('Tool Definitions', () => {
    it('should have 10 tools defined', () => {
      expect(TOOLS).toHaveLength(10);
    });

    it('each tool should have name, description, and parameters', () => {
      for (const tool of TOOLS) {
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.parameters).toBeTruthy();
        expect(tool.parameters.type).toBe('object');
      }
    });

    it('tool names should be unique', () => {
      const names = TOOLS.map(t => t.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('all tools should have executors', () => {
      for (const tool of TOOLS) {
        expect(typeof executors[tool.name]).toBe('function');
      }
    });
  });

  describe('Approval Rules', () => {
    it('run_command always needs approval', () => {
      expect(needsApproval('run_command', {})).toBe(true);
    });

    it('write_file always needs approval', () => {
      expect(needsApproval('write_file', {})).toBe(true);
    });

    it('read_file never needs approval', () => {
      expect(needsApproval('read_file', {})).toBe(false);
    });

    it('list_directory never needs approval', () => {
      expect(needsApproval('list_directory', {})).toBe(false);
    });

    it('search_files never needs approval', () => {
      expect(needsApproval('search_files', {})).toBe(false);
    });

    it('system_info never needs approval', () => {
      expect(needsApproval('system_info', {})).toBe(false);
    });

    it('http_request never needs approval', () => {
      expect(needsApproval('http_request', {})).toBe(false);
    });

    it('docker stop needs approval', () => {
      expect(needsApproval('docker_action', { action: 'stop' })).toBe(true);
    });

    it('docker ps does not need approval', () => {
      expect(needsApproval('docker_action', { action: 'ps' })).toBe(false);
    });

    it('git commit needs approval', () => {
      expect(needsApproval('git_action', { action: 'commit' })).toBe(true);
    });

    it('git status does not need approval', () => {
      expect(needsApproval('git_action', { action: 'status' })).toBe(false);
    });

    it('process kill needs approval', () => {
      expect(needsApproval('process_action', { action: 'kill' })).toBe(true);
    });

    it('process list does not need approval', () => {
      expect(needsApproval('process_action', { action: 'list' })).toBe(false);
    });

    it('unknown tools default to needing approval', () => {
      expect(needsApproval('unknown_tool', {})).toBe(true);
    });
  });

  describe('Command Safety', () => {
    it('blocks rm -rf /', () => {
      expect(isCmdBlocked('rm -rf /')).toBe(true);
    });

    it('blocks mkfs', () => {
      expect(isCmdBlocked('mkfs /dev/sda1')).toBe(true);
    });

    it('blocks dd if=', () => {
      expect(isCmdBlocked('dd if=/dev/zero of=/dev/sda')).toBe(true);
    });

    it('blocks fork bomb', () => {
      expect(isCmdBlocked(':(){:|:&};:')).toBe(true);
    });

    it('allows safe commands', () => {
      expect(isCmdBlocked('ls -la')).toBe(false);
      expect(isCmdBlocked('cat /etc/hostname')).toBe(false);
      expect(isCmdBlocked('docker ps')).toBe(false);
    });
  });

  describe('Path Safety', () => {
    it('resolves home path', () => {
      const result = resolveSafePath('~/test.txt');
      expect(result).toContain('test.txt');
      expect(result.startsWith('/')).toBe(true);
    });

    it('allows paths under home', () => {
      const home = require('os').homedir();
      expect(isPathSafe(`${home}/test.txt`)).toBe(true);
    });

    it('allows /tmp paths', () => {
      expect(isPathSafe('/tmp/test.txt')).toBe(true);
    });

    it('blocks system paths', () => {
      expect(isPathSafe('/etc/passwd')).toBe(false);
      expect(isPathSafe('/usr/bin/test')).toBe(false);
    });
  });

  describe('Tool Executors', () => {
    it('run_command blocks dangerous commands', async () => {
      const result = await executors.run_command({ command: 'rm -rf /' });
      expect(result.blocked).toBe(true);
    });

    it('system_info returns data', async () => {
      const result = await executors.system_info({ category: 'cpu' });
      expect(result.cpu).toBeTruthy();
      expect(result.cpu.cores).toBeGreaterThan(0);
    });

    it('list_directory lists home', async () => {
      const result = await executors.list_directory({});
      expect(result.items).toBeTruthy();
      expect(Array.isArray(result.items)).toBe(true);
    });

    it('read_file handles missing files', async () => {
      const result = await executors.read_file({ path: '/nonexistent/file.txt' });
      expect(result.error).toBeTruthy();
    });

    it('write_file blocks paths outside home', async () => {
      const result = await executors.write_file({ path: '/etc/test', content: 'test' });
      expect(result.error).toContain('blocked');
    });
  });
});
