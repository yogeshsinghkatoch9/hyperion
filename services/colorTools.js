/* ═══ HYPERION — Color Tools Service ═══ */
const { v4: uuid } = require('uuid');

const NAMED_COLORS = {
  red: '#ff0000', green: '#008000', blue: '#0000ff', white: '#ffffff', black: '#000000',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', orange: '#ffa500', purple: '#800080',
  pink: '#ffc0cb', gray: '#808080', grey: '#808080', navy: '#000080', teal: '#008080',
  maroon: '#800000', olive: '#808000', lime: '#00ff00', aqua: '#00ffff', silver: '#c0c0c0',
  coral: '#ff7f50', salmon: '#fa8072', gold: '#ffd700', indigo: '#4b0082', violet: '#ee82ee',
};

/** Parse flexible color input → { hex, r, g, b } */
function parseColor(input) {
  if (!input || typeof input !== 'string') throw new Error('Color input is required');
  const s = input.trim().toLowerCase();

  // Named color
  if (NAMED_COLORS[s]) return { hex: NAMED_COLORS[s], ...hexToRgb(NAMED_COLORS[s]) };

  // Hex: #fff or #ffffff
  if (s.startsWith('#')) {
    let hex = s;
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    if (!/^#[0-9a-f]{6}$/.test(hex)) throw new Error('Invalid hex color');
    return { hex, ...hexToRgb(hex) };
  }

  // rgb(r, g, b)
  const rgbMatch = s.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number);
    if (r > 255 || g > 255 || b > 255) throw new Error('RGB values must be 0-255');
    return { hex: rgbToHex(r, g, b), r, g, b };
  }

  // hsl(h, s%, l%)
  const hslMatch = s.match(/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*\)$/);
  if (hslMatch) {
    const [, h, sat, l] = hslMatch.map(Number);
    const hex = hslToHex(h, sat, l);
    return { hex, ...hexToRgb(hex) };
  }

  throw new Error(`Unrecognized color format: "${input}"`);
}

/** #ff0088 → { r, g, b } */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** { r, g, b } → "#ff0088" */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/** #hex → { h, s, l } */
function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsl(r, g, b);
}

/** { h, s, l } → "#hex" */
function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

/** RGB → HSL */
function rgbToHsl(r, g, b) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** HSL → RGB */
function hslToRgb(h, s, l) {
  const sn = s / 100, ln = l / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hn = h / 360;
  return {
    r: Math.round(hue2rgb(p, q, hn + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1/3) * 255),
  };
}

/** Relative luminance per WCAG 2.0 */
function getLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG contrast ratio between two colors */
function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1);
  const l2 = getLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Check WCAG compliance */
function meetsWCAG(hex1, hex2, level = 'AA') {
  const ratio = getContrastRatio(hex1, hex2);
  return {
    ratio: Math.round(ratio * 100) / 100,
    AA: { normalText: ratio >= 4.5, largeText: ratio >= 3 },
    AAA: { normalText: ratio >= 7, largeText: ratio >= 4.5 },
    passes: level === 'AAA' ? ratio >= 7 : ratio >= 4.5,
  };
}

/** Generate palette from base color */
function generatePalette(baseHex, type = 'complementary') {
  const { h, s, l } = hexToHsl(baseHex);
  const colors = [baseHex];

  switch (type) {
    case 'complementary':
      colors.push(hslToHex((h + 180) % 360, s, l));
      break;
    case 'analogous':
      colors.push(hslToHex((h + 30) % 360, s, l));
      colors.push(hslToHex((h + 330) % 360, s, l));
      break;
    case 'triadic':
      colors.push(hslToHex((h + 120) % 360, s, l));
      colors.push(hslToHex((h + 240) % 360, s, l));
      break;
    case 'split-complementary':
      colors.push(hslToHex((h + 150) % 360, s, l));
      colors.push(hslToHex((h + 210) % 360, s, l));
      break;
    case 'monochromatic':
      colors.push(hslToHex(h, s, Math.min(100, l + 20)));
      colors.push(hslToHex(h, s, Math.max(0, l - 20)));
      colors.push(hslToHex(h, Math.max(0, s - 20), l));
      colors.push(hslToHex(h, Math.min(100, s + 20), l));
      break;
    default:
      colors.push(hslToHex((h + 180) % 360, s, l));
  }

  return { base: baseHex, type, colors };
}

/** Lighten a color */
function lighten(hex, amount = 10) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + amount));
}

/** Darken a color */
function darken(hex, amount = 10) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
}

/** Saturate a color */
function saturate(hex, amount = 10) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.min(100, s + amount), l);
}

/** Desaturate a color */
function desaturate(hex, amount = 10) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, Math.max(0, s - amount), l);
}

/** Generate N shades from light to dark */
function generateShades(hex, steps = 9) {
  const { h, s } = hexToHsl(hex);
  const shades = [];
  for (let i = 0; i < steps; i++) {
    const l = Math.round(95 - (i * (90 / (steps - 1))));
    shades.push(hslToHex(h, s, l));
  }
  return shades;
}

/** Random hex color */
function randomColor() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/** Save palette to DB */
function savePalette(db, { name, colors, type }) {
  const id = uuid();
  db.prepare('INSERT INTO color_palettes (id, name, colors, type) VALUES (?, ?, ?, ?)')
    .run(id, name || 'Untitled', JSON.stringify(colors || []), type || 'custom');
  return { id, name, colors, type };
}

/** List palettes */
function getPalettes(db) {
  return db.prepare('SELECT * FROM color_palettes ORDER BY created_at DESC').all()
    .map(r => ({ ...r, colors: JSON.parse(r.colors || '[]') }));
}

/** Get palette by id */
function getPalette(db, id) {
  const row = db.prepare('SELECT * FROM color_palettes WHERE id = ?').get(id);
  if (!row) throw new Error('Palette not found');
  return { ...row, colors: JSON.parse(row.colors || '[]') };
}

/** Delete palette */
function deletePalette(db, id) {
  const info = db.prepare('DELETE FROM color_palettes WHERE id = ?').run(id);
  if (info.changes === 0) throw new Error('Palette not found');
}

module.exports = {
  hexToRgb, rgbToHex, hexToHsl, hslToHex, rgbToHsl, hslToRgb,
  getContrastRatio, meetsWCAG, getLuminance,
  generatePalette, lighten, darken, saturate, desaturate,
  generateShades, randomColor, parseColor,
  savePalette, getPalettes, getPalette, deletePalette,
};
