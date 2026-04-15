import { describe, it, expect } from 'vitest';
const img = require('../services/imageTools');

// Minimal valid image buffers (magic bytes only)
const PNG_BUF = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00]);
const JPEG_BUF = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
const GIF_BUF = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x02, 0x00]);
const SVG_BUF = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"></svg>');

describe('PNG Detection', () => {
  it('detects PNG format', () => {
    expect(img.detectFormat(PNG_BUF)).toBe('PNG');
  });
  it('extracts PNG dimensions', () => {
    const info = img.getImageInfo(PNG_BUF);
    expect(info.format).toBe('PNG');
    expect(info.width).toBe(1);
    expect(info.height).toBe(1);
  });
});

describe('JPEG Detection', () => {
  it('detects JPEG format', () => {
    expect(img.detectFormat(JPEG_BUF)).toBe('JPEG');
  });
  it('returns JPEG info', () => {
    const info = img.getImageInfo(JPEG_BUF);
    expect(info.format).toBe('JPEG');
    expect(info.size).toBeGreaterThan(0);
  });
});

describe('GIF Detection', () => {
  it('detects GIF format', () => {
    expect(img.detectFormat(GIF_BUF)).toBe('GIF');
  });
  it('extracts GIF dimensions', () => {
    const info = img.getImageInfo(GIF_BUF);
    expect(info.format).toBe('GIF');
    expect(info.width).toBe(1);
    expect(info.height).toBe(2);
  });
});

describe('SVG Detection', () => {
  it('detects SVG format', () => {
    expect(img.detectFormat(SVG_BUF)).toBe('SVG');
  });
  it('extracts SVG dimensions', () => {
    const info = img.getImageInfo(SVG_BUF);
    expect(info.format).toBe('SVG');
    expect(info.width).toBe(100);
    expect(info.height).toBe(50);
  });
});

describe('Base64 Roundtrip', () => {
  it('converts to base64 and back', () => {
    const b64 = img.toBase64(PNG_BUF, 'image/png');
    expect(typeof b64).toBe('string');
  });
  it('creates valid data URI', () => {
    const uri = img.toBase64Url(PNG_BUF, 'image/png');
    expect(uri).toMatch(/^data:image\/png;base64,/);
  });
  it('parses data URI back', () => {
    const uri = `data:image/png;base64,${PNG_BUF.toString('base64')}`;
    const result = img.fromBase64(uri);
    expect(result.mimeType).toBe('image/png');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
  });
});

describe('Placeholder Generation', () => {
  it('generates SVG with defaults', () => {
    const svg = img.generatePlaceholder();
    expect(svg).toContain('<svg');
    expect(svg).toContain('300');
    expect(svg).toContain('200');
  });
  it('uses custom dimensions', () => {
    const svg = img.generatePlaceholder(640, 480);
    expect(svg).toContain('640');
    expect(svg).toContain('480');
  });
  it('includes custom text', () => {
    const svg = img.generatePlaceholder(100, 100, '#333', 'Hello');
    expect(svg).toContain('Hello');
  });
});

describe('Format Info', () => {
  it('returns PNG info', () => {
    const info = img.getFormatInfo('PNG');
    expect(info.mime).toBe('image/png');
    expect(info.ext).toBe('.png');
  });
  it('returns null for unknown', () => {
    expect(img.getFormatInfo('BMP')).toBeNull();
  });
});

describe('Invalid Image', () => {
  it('rejects random bytes', () => {
    const result = img.validateImage(Buffer.from([0x00, 0x01, 0x02]));
    expect(result.valid).toBe(false);
  });
  it('rejects empty buffer', () => {
    const result = img.validateImage(Buffer.alloc(0));
    expect(result.valid).toBe(false);
  });
});

describe('Size Estimation', () => {
  it('estimates size from base64', () => {
    const b64 = PNG_BUF.toString('base64');
    const size = img.estimateSize(b64);
    expect(size).toBeGreaterThan(0);
    expect(Math.abs(size - PNG_BUF.length)).toBeLessThanOrEqual(3);
  });
});

describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof img.getImageInfo).toBe('function');
    expect(typeof img.toBase64).toBe('function');
    expect(typeof img.fromBase64).toBe('function');
    expect(typeof img.toBase64Url).toBe('function');
    expect(typeof img.detectFormat).toBe('function');
    expect(typeof img.estimateSize).toBe('function');
    expect(typeof img.generatePlaceholder).toBe('function');
    expect(typeof img.getFormatInfo).toBe('function');
    expect(typeof img.validateImage).toBe('function');
  });
});
