import { describe, it, expect } from 'vitest';
const clr = require('../services/colorTools');

describe('Hex to RGB', () => {
  it('converts full hex', () => {
    expect(clr.hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
  });
  it('converts short hex', () => {
    expect(clr.hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });
  it('converts mixed hex', () => {
    const { r, g, b } = clr.hexToRgb('#00ff88');
    expect(r).toBe(0);
    expect(g).toBe(255);
    expect(b).toBe(136);
  });
});

describe('RGB to Hex', () => {
  it('converts RGB to hex', () => {
    expect(clr.rgbToHex(255, 0, 0)).toBe('#ff0000');
  });
  it('pads with zeros', () => {
    expect(clr.rgbToHex(0, 0, 0)).toBe('#000000');
  });
  it('clamps values', () => {
    expect(clr.rgbToHex(300, -10, 128)).toBe('#ff0080');
  });
});

describe('HSL Conversions', () => {
  it('converts hex to HSL (red)', () => {
    const hsl = clr.hexToHsl('#ff0000');
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBe(50);
  });
  it('converts HSL to hex (blue)', () => {
    const hex = clr.hslToHex(240, 100, 50);
    expect(hex).toBe('#0000ff');
  });
  it('roundtrips RGB → HSL → RGB', () => {
    const { h, s, l } = clr.rgbToHsl(128, 64, 192);
    const { r, g, b } = clr.hslToRgb(h, s, l);
    expect(Math.abs(r - 128)).toBeLessThanOrEqual(1);
    expect(Math.abs(g - 64)).toBeLessThanOrEqual(1);
    expect(Math.abs(b - 192)).toBeLessThanOrEqual(1);
  });
  it('handles grayscale', () => {
    const hsl = clr.rgbToHsl(128, 128, 128);
    expect(hsl.s).toBe(0);
  });
});

describe('Contrast Ratio', () => {
  it('calculates max contrast (black vs white)', () => {
    const ratio = clr.getContrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });
  it('calculates min contrast (same color)', () => {
    const ratio = clr.getContrastRatio('#888888', '#888888');
    expect(ratio).toBeCloseTo(1, 0);
  });
  it('is symmetric', () => {
    const r1 = clr.getContrastRatio('#ff0000', '#0000ff');
    const r2 = clr.getContrastRatio('#0000ff', '#ff0000');
    expect(r1).toBeCloseTo(r2, 2);
  });
});

describe('WCAG Compliance', () => {
  it('black on white passes AAA', () => {
    const r = clr.meetsWCAG('#000000', '#ffffff', 'AAA');
    expect(r.passes).toBe(true);
    expect(r.AAA.normalText).toBe(true);
  });
  it('similar colors fail AA', () => {
    const r = clr.meetsWCAG('#777777', '#888888', 'AA');
    expect(r.passes).toBe(false);
  });
  it('returns ratio', () => {
    const r = clr.meetsWCAG('#000000', '#ffffff');
    expect(r.ratio).toBeGreaterThan(20);
  });
});

describe('Palette Generation', () => {
  it('generates complementary', () => {
    const p = clr.generatePalette('#ff0000', 'complementary');
    expect(p.colors).toHaveLength(2);
    expect(p.type).toBe('complementary');
  });
  it('generates triadic', () => {
    const p = clr.generatePalette('#ff0000', 'triadic');
    expect(p.colors).toHaveLength(3);
  });
  it('generates monochromatic', () => {
    const p = clr.generatePalette('#ff0000', 'monochromatic');
    expect(p.colors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Shades', () => {
  it('generates requested number of shades', () => {
    const shades = clr.generateShades('#ff0000', 5);
    expect(shades).toHaveLength(5);
  });
  it('all shades are valid hex', () => {
    const shades = clr.generateShades('#00ff88', 7);
    shades.forEach(s => expect(s).toMatch(/^#[0-9a-f]{6}$/));
  });
});

describe('Parse Flexible Input', () => {
  it('parses named colors', () => {
    const r = clr.parseColor('red');
    expect(r.hex).toBe('#ff0000');
  });
  it('parses rgb() format', () => {
    const r = clr.parseColor('rgb(0, 128, 255)');
    expect(r.r).toBe(0);
    expect(r.g).toBe(128);
    expect(r.b).toBe(255);
  });
});

describe('Exports', () => {
  it('exports all required functions', () => {
    expect(typeof clr.hexToRgb).toBe('function');
    expect(typeof clr.rgbToHex).toBe('function');
    expect(typeof clr.hexToHsl).toBe('function');
    expect(typeof clr.hslToHex).toBe('function');
    expect(typeof clr.rgbToHsl).toBe('function');
    expect(typeof clr.hslToRgb).toBe('function');
    expect(typeof clr.getContrastRatio).toBe('function');
    expect(typeof clr.meetsWCAG).toBe('function');
    expect(typeof clr.getLuminance).toBe('function');
    expect(typeof clr.generatePalette).toBe('function');
    expect(typeof clr.lighten).toBe('function');
    expect(typeof clr.darken).toBe('function');
    expect(typeof clr.generateShades).toBe('function');
    expect(typeof clr.randomColor).toBe('function');
    expect(typeof clr.parseColor).toBe('function');
    expect(typeof clr.savePalette).toBe('function');
    expect(typeof clr.getPalettes).toBe('function');
    expect(typeof clr.deletePalette).toBe('function');
  });
});
