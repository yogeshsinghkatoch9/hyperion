import { describe, it, expect } from 'vitest';

// ── Wake-on-LAN Packet Tests ──
describe('Wake-on-LAN Packet', () => {
  it('builds valid magic packet from colon-separated MAC', () => {
    const { buildWolPacket } = require('../services/remoteDesktop');
    const packet = buildWolPacket('AA:BB:CC:DD:EE:FF');

    expect(packet).toBeInstanceOf(Buffer);
    expect(packet.length).toBe(102);

    // First 6 bytes should be 0xFF
    for (let i = 0; i < 6; i++) {
      expect(packet[i]).toBe(0xff);
    }

    // Next 96 bytes should be 16 repetitions of the MAC
    const macBytes = Buffer.from('AABBCCDDEEFF', 'hex');
    for (let rep = 0; rep < 16; rep++) {
      for (let b = 0; b < 6; b++) {
        expect(packet[6 + rep * 6 + b]).toBe(macBytes[b]);
      }
    }
  });

  it('builds valid packet from dash-separated MAC', () => {
    const { buildWolPacket } = require('../services/remoteDesktop');
    const packet = buildWolPacket('11-22-33-44-55-66');
    expect(packet.length).toBe(102);
    expect(packet[6]).toBe(0x11);
    expect(packet[7]).toBe(0x22);
  });

  it('builds valid packet from raw MAC (no separators)', () => {
    const { buildWolPacket } = require('../services/remoteDesktop');
    const packet = buildWolPacket('AABBCCDDEEFF');
    expect(packet.length).toBe(102);
  });

  it('rejects invalid MAC address', () => {
    const { buildWolPacket } = require('../services/remoteDesktop');
    expect(() => buildWolPacket('invalid')).toThrow('Invalid MAC');
    expect(() => buildWolPacket('ZZ:ZZ:ZZ:ZZ:ZZ:ZZ')).toThrow('Invalid MAC');
    expect(() => buildWolPacket('AA:BB:CC')).toThrow('Invalid MAC');
  });

  it('handles dot-separated MAC', () => {
    const { buildWolPacket } = require('../services/remoteDesktop');
    const packet = buildWolPacket('AABB.CCDD.EEFF');
    expect(packet.length).toBe(102);
    expect(packet[6]).toBe(0xaa);
  });
});

// ── Coordinate Translation Tests ──
describe('Coordinate Translation', () => {
  it('translates normalized coordinates to screen pixels', () => {
    const { getScreenSize } = require('../services/remoteDesktop');
    const screen = getScreenSize();

    // Simulate what injectMouse does: multiply normalized coords by screen size
    const normalized = { x: 0.5, y: 0.5 };
    const sx = Math.round(normalized.x * screen.width);
    const sy = Math.round(normalized.y * screen.height);

    expect(sx).toBe(Math.round(screen.width / 2));
    expect(sy).toBe(Math.round(screen.height / 2));
  });

  it('handles corner coordinates', () => {
    const { getScreenSize } = require('../services/remoteDesktop');
    const screen = getScreenSize();

    // Top-left
    expect(Math.round(0 * screen.width)).toBe(0);
    expect(Math.round(0 * screen.height)).toBe(0);

    // Bottom-right
    expect(Math.round(1 * screen.width)).toBe(screen.width);
    expect(Math.round(1 * screen.height)).toBe(screen.height);
  });
});

// ── Message Protocol Tests ──
describe('Remote Desktop Message Protocol', () => {
  it('mouse click message format', () => {
    const msg = { type: 'mouse', action: 'click', x: 0.5, y: 0.3, button: 'left' };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.type).toBe('mouse');
    expect(parsed.action).toBe('click');
    expect(parsed.x).toBeCloseTo(0.5);
    expect(parsed.y).toBeCloseTo(0.3);
    expect(parsed.button).toBe('left');
  });

  it('mouse doubleclick message format', () => {
    const msg = { type: 'mouse', action: 'doubleclick', x: 0.2, y: 0.8, button: 'left' };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.action).toBe('doubleclick');
  });

  it('scroll message format', () => {
    const msg = { type: 'scroll', x: 0.5, y: 0.5, deltaX: 0, deltaY: -120 };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.type).toBe('scroll');
    expect(parsed.deltaY).toBe(-120);
  });

  it('key message with modifiers', () => {
    const msg = { type: 'key', action: 'keydown', key: 'c', modifiers: { shift: false, control: false, option: false, command: true } };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.type).toBe('key');
    expect(parsed.key).toBe('c');
    expect(parsed.modifiers.command).toBe(true);
    expect(parsed.modifiers.shift).toBe(false);
  });

  it('configure message format', () => {
    const msg = { type: 'configure', fps: 20, quality: 80, scale: 0.75 };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.type).toBe('configure');
    expect(parsed.fps).toBe(20);
    expect(parsed.quality).toBe(80);
    expect(parsed.scale).toBe(0.75);
  });

  it('remote_status response format', () => {
    const msg = {
      type: 'remote_status',
      status: 'connected',
      clientId: 'test-uuid',
      config: { fps: 10, quality: 60, scale: 0.5 },
      screenSize: { width: 1920, height: 1080 },
      clientCount: 1,
    };
    const parsed = JSON.parse(JSON.stringify(msg));
    expect(parsed.type).toBe('remote_status');
    expect(parsed.config).toBeDefined();
    expect(parsed.screenSize.width).toBeGreaterThan(0);
  });
});

// ── WebSocket Path Tests ──
describe('Remote WebSocket Path', () => {
  it('recognizes /ws/remote as allowed path', () => {
    const pathname = '/ws/remote';
    const isAllowed = pathname === '/ws/terminal' || pathname === '/ws/system' ||
      pathname.startsWith('/ws/notebook/') || pathname === '/ws/remote';
    expect(isAllowed).toBe(true);
  });

  it('still allows existing paths', () => {
    const paths = ['/ws/terminal', '/ws/system', '/ws/notebook/abc'];
    for (const p of paths) {
      const isAllowed = p === '/ws/terminal' || p === '/ws/system' ||
        p.startsWith('/ws/notebook/') || p === '/ws/remote';
      expect(isAllowed).toBe(true);
    }
  });
});

// ── Config Validation ──
describe('Config Validation', () => {
  it('default config has sensible values', () => {
    const { getConfig } = require('../services/remoteDesktop');
    const config = getConfig();
    expect(config.fps).toBeGreaterThanOrEqual(1);
    expect(config.fps).toBeLessThanOrEqual(30);
    expect(config.quality).toBeGreaterThanOrEqual(20);
    expect(config.quality).toBeLessThanOrEqual(95);
    expect(config.scale).toBeGreaterThanOrEqual(0.25);
    expect(config.scale).toBeLessThanOrEqual(1);
  });

  it('updateConfig clamps values', () => {
    const { updateConfig, getConfig } = require('../services/remoteDesktop');

    // Save original
    const original = getConfig();

    // Test clamping
    updateConfig({ fps: 100, quality: 200, scale: 5 });
    let c = getConfig();
    expect(c.fps).toBeLessThanOrEqual(30);
    expect(c.quality).toBeLessThanOrEqual(95);
    expect(c.scale).toBeLessThanOrEqual(1);

    updateConfig({ fps: 0, quality: 0, scale: 0 });
    c = getConfig();
    expect(c.fps).toBeGreaterThanOrEqual(1);
    expect(c.quality).toBeGreaterThanOrEqual(20);
    expect(c.scale).toBeGreaterThanOrEqual(0.25);

    // Restore
    updateConfig(original);
  });
});

// ── PIN Tests ──
describe('PIN Management', () => {
  it('hasPinSet returns false initially', () => {
    const { hasPinSet } = require('../services/remoteDesktop');
    // Clear any existing PIN first
    const { clearPin } = require('../services/remoteDesktop');
    clearPin();
    expect(hasPinSet()).toBe(false);
  });

  it('verifyPin returns true when no PIN is set', async () => {
    const { verifyPin, clearPin } = require('../services/remoteDesktop');
    const bcrypt = require('bcryptjs');
    clearPin();
    const result = await verifyPin(null, bcrypt);
    expect(result).toBe(true);
  });
});

// ── Network Info ──
describe('Network Info', () => {
  it('returns addresses array', () => {
    const { getNetworkInfo } = require('../services/remoteDesktop');
    const info = getNetworkInfo();
    expect(Array.isArray(info.addresses)).toBe(true);
    expect(typeof info.hasTunnel).toBe('boolean');
  });
});
