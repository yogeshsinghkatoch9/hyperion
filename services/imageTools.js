/* ═══ HYPERION — Image Tools Service ═══ */

const SIGNATURES = {
  PNG:  { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png', ext: '.png', description: 'Portable Network Graphics' },
  JPEG: { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg', ext: '.jpg', description: 'JPEG Image' },
  GIF:  { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif', ext: '.gif', description: 'Graphics Interchange Format' },
  WEBP_RIFF: { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', ext: '.webp', description: 'WebP Image' },
};

/** Detect image format from magic bytes */
function detectFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;

  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'PNG';
  // JPEG
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'JPEG';
  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'GIF';
  // WEBP (RIFF....WEBP)
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer.length >= 12) {
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return 'WEBP';
  }
  // SVG
  const head = buffer.slice(0, Math.min(256, buffer.length)).toString('utf8').trim();
  if (head.startsWith('<svg') || head.startsWith('<?xml') && head.includes('<svg')) return 'SVG';

  return null;
}

/** Get image info: format, dimensions, size */
function getImageInfo(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Buffer is required');
  const format = detectFormat(buffer);
  if (!format) throw new Error('Unrecognized image format');

  const info = { format, size: buffer.length, width: null, height: null };

  if (format === 'PNG' && buffer.length >= 24) {
    info.width = buffer.readUInt32BE(16);
    info.height = buffer.readUInt32BE(20);
  } else if (format === 'JPEG') {
    // Scan for SOF0/SOF2 marker
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xFF) break;
      const marker = buffer[offset + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        info.height = buffer.readUInt16BE(offset + 5);
        info.width = buffer.readUInt16BE(offset + 7);
        break;
      }
      const segLen = buffer.readUInt16BE(offset + 2);
      offset += 2 + segLen;
    }
  } else if (format === 'GIF' && buffer.length >= 10) {
    info.width = buffer.readUInt16LE(6);
    info.height = buffer.readUInt16LE(8);
  } else if (format === 'WEBP' && buffer.length >= 30) {
    // VP8 chunk
    if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38) {
      if (buffer[15] === 0x20 && buffer.length >= 30) { // VP8 lossy
        info.width = buffer.readUInt16LE(26) & 0x3FFF;
        info.height = buffer.readUInt16LE(28) & 0x3FFF;
      } else if (buffer[15] === 0x4C && buffer.length >= 25) { // VP8L lossless
        const bits = buffer.readUInt32LE(21);
        info.width = (bits & 0x3FFF) + 1;
        info.height = ((bits >> 14) & 0x3FFF) + 1;
      }
    }
  } else if (format === 'SVG') {
    const str = buffer.toString('utf8');
    const wMatch = str.match(/width=["'](\d+)/);
    const hMatch = str.match(/height=["'](\d+)/);
    if (wMatch) info.width = parseInt(wMatch[1]);
    if (hMatch) info.height = parseInt(hMatch[1]);
    const vb = str.match(/viewBox=["'][\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/);
    if (vb && !info.width) { info.width = Math.round(parseFloat(vb[1])); info.height = Math.round(parseFloat(vb[2])); }
  }

  return info;
}

/** Convert buffer to data URI */
function toBase64(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Buffer is required');
  const mime = mimeType || getMimeForFormat(detectFormat(buffer));
  return buffer.toString('base64');
}

/** Full data URI with prefix */
function toBase64Url(buffer, mimeType) {
  const mime = mimeType || getMimeForFormat(detectFormat(buffer));
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** Parse data URI back to buffer + mimeType */
function fromBase64(dataUri) {
  if (!dataUri || typeof dataUri !== 'string') throw new Error('Data URI is required');
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid data URI format');
  return { buffer: Buffer.from(match[2], 'base64'), mimeType: match[1] };
}

/** Estimate byte size from base64 string */
function estimateSize(base64) {
  if (!base64 || typeof base64 !== 'string') return 0;
  const clean = base64.replace(/^data:[^;]+;base64,/, '');
  const padding = (clean.match(/=+$/) || [''])[0].length;
  return Math.floor((clean.length * 3) / 4) - padding;
}

/** Generate SVG placeholder image */
function generatePlaceholder(width, height, color, text) {
  const w = width || 300;
  const h = height || 200;
  const bg = color || '#1a1a28';
  const label = text || `${w}×${h}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#8888a0" font-family="monospace" font-size="14">${label}</text>
</svg>`;
}

/** Get format info */
function getFormatInfo(format) {
  const formats = {
    PNG:  { mime: 'image/png', ext: '.png', description: 'Portable Network Graphics — lossless compression, supports transparency' },
    JPEG: { mime: 'image/jpeg', ext: '.jpg', description: 'JPEG — lossy compression, best for photos' },
    GIF:  { mime: 'image/gif', ext: '.gif', description: 'GIF — limited colors, supports animation' },
    WEBP: { mime: 'image/webp', ext: '.webp', description: 'WebP — modern format, lossy and lossless' },
    SVG:  { mime: 'image/svg+xml', ext: '.svg', description: 'SVG — vector format, scalable without quality loss' },
  };
  return formats[format?.toUpperCase()] || null;
}

/** Validate if buffer is a valid image */
function validateImage(buffer) {
  if (!Buffer.isBuffer(buffer)) return { valid: false, error: 'Not a buffer' };
  if (buffer.length === 0) return { valid: false, error: 'Empty buffer' };
  const format = detectFormat(buffer);
  if (!format) return { valid: false, error: 'Unrecognized image format' };
  return { valid: true, format };
}

function getMimeForFormat(format) {
  const map = { PNG: 'image/png', JPEG: 'image/jpeg', GIF: 'image/gif', WEBP: 'image/webp', SVG: 'image/svg+xml' };
  return map[format] || 'application/octet-stream';
}

module.exports = {
  getImageInfo, toBase64, fromBase64, toBase64Url,
  detectFormat, estimateSize, generatePlaceholder,
  getFormatInfo, validateImage,
};
