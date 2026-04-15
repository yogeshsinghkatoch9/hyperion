// ── Case Transforms ──
function toUpperCase(text) { return (text || '').toUpperCase(); }
function toLowerCase(text) { return (text || '').toLowerCase(); }

function toTitleCase(text) {
  return (text || '').replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function toCamelCase(text) {
  return (text || '').replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^[A-Z]/, c => c.toLowerCase());
}

function toSnakeCase(text) {
  return (text || '').replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_').toLowerCase();
}

function toKebabCase(text) {
  return (text || '').replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-').toLowerCase();
}

function toPascalCase(text) {
  return (text || '').replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
    .replace(/^[a-z]/, c => c.toUpperCase());
}

function toConstantCase(text) {
  return (text || '').replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_').toUpperCase();
}

// ── Line Operations ──
function sortLines(text, direction) {
  const lines = (text || '').split('\n');
  lines.sort((a, b) => direction === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
  return lines.join('\n');
}

function reverseLines(text) {
  return (text || '').split('\n').reverse().join('\n');
}

function shuffleLines(text) {
  const lines = (text || '').split('\n');
  for (let i = lines.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lines[i], lines[j]] = [lines[j], lines[i]];
  }
  return lines.join('\n');
}

function deduplicateLines(text) {
  return [...new Set((text || '').split('\n'))].join('\n');
}

function numberLines(text) {
  return (text || '').split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
}

function removeEmptyLines(text) {
  return (text || '').split('\n').filter(l => l.trim().length > 0).join('\n');
}

function trimLines(text) {
  return (text || '').split('\n').map(l => l.trim()).join('\n');
}

// ── Text Utils ──
function reverseText(text) { return (text || '').split('').reverse().join(''); }
function countWords(text) { return (text || '').trim().split(/\s+/).filter(w => w.length > 0).length; }
function countChars(text) { return (text || '').length; }
function countLines(text) { return text ? text.split('\n').length : 0; }

function wrapLines(text, width) {
  const w = width || 80;
  const lines = (text || '').split('\n');
  const result = [];
  for (const line of lines) {
    if (line.length <= w) { result.push(line); continue; }
    let remaining = line;
    while (remaining.length > w) {
      let breakIdx = remaining.lastIndexOf(' ', w);
      if (breakIdx <= 0) breakIdx = w;
      result.push(remaining.substring(0, breakIdx));
      remaining = remaining.substring(breakIdx).trimStart();
    }
    if (remaining) result.push(remaining);
  }
  return result.join('\n');
}

function unwrapLines(text) {
  return (text || '').replace(/\n(?!\n)/g, ' ').replace(/  +/g, ' ');
}

// ── Encode/Decode ──
function rot13(text) {
  return (text || '').replace(/[a-zA-Z]/g, c => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

const MORSE_MAP = {
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  ' ': '/',
};

const REVERSE_MORSE = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

function toMorseCode(text) {
  return (text || '').toUpperCase().split('').map(c => MORSE_MAP[c] || c).join(' ');
}

function fromMorseCode(text) {
  return (text || '').split(' ').map(c => REVERSE_MORSE[c] || c).join('');
}

// ── Generators ──
const LOREM_SENTENCES = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
  'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
  'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.',
  'Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet.',
  'Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse.',
];

function loremIpsum(paragraphs) {
  const count = Math.max(1, Math.min(paragraphs || 1, 20));
  const result = [];
  for (let i = 0; i < count; i++) {
    const sentCount = 3 + Math.floor(Math.random() * 4);
    const sentences = [];
    for (let j = 0; j < sentCount; j++) {
      sentences.push(LOREM_SENTENCES[Math.floor(Math.random() * LOREM_SENTENCES.length)]);
    }
    result.push(sentences.join(' '));
  }
  return result.join('\n\n');
}

function generatePassword(length, options) {
  const len = Math.max(4, Math.min(length || 16, 128));
  const opts = options || {};
  let chars = '';
  if (opts.uppercase !== false) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (opts.lowercase !== false) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (opts.numbers !== false) chars += '0123456789';
  if (opts.symbols !== false) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ── Extractors ──
function extractEmails(text) {
  return (text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
}

function extractUrls(text) {
  return (text || '').match(/https?:\/\/[^\s<>"{}|\\^`[\]]+/g) || [];
}

function extractNumbers(text) {
  return ((text || '').match(/-?\d+\.?\d*/g) || []).map(Number);
}

// ── Transform Registry ──
const TRANSFORMS = {
  toUpperCase, toLowerCase, toTitleCase, toCamelCase, toSnakeCase,
  toKebabCase, toPascalCase, toConstantCase,
  sortLines, reverseLines, shuffleLines, deduplicateLines, numberLines,
  removeEmptyLines, trimLines,
  reverseText, countWords, countChars, countLines, wrapLines, unwrapLines,
  rot13, toMorseCode, fromMorseCode,
  loremIpsum, generatePassword,
  extractEmails, extractUrls, extractNumbers,
};

function listTransforms() {
  return Object.keys(TRANSFORMS);
}

function applyTransform(name, text, options) {
  const fn = TRANSFORMS[name];
  if (!fn) throw new Error(`Unknown transform: ${name}`);
  return fn(text, options);
}

module.exports = {
  toUpperCase, toLowerCase, toTitleCase, toCamelCase, toSnakeCase,
  toKebabCase, toPascalCase, toConstantCase,
  sortLines, reverseLines, shuffleLines, deduplicateLines, numberLines,
  removeEmptyLines, trimLines,
  reverseText, countWords, countChars, countLines, wrapLines, unwrapLines,
  rot13, toMorseCode, fromMorseCode,
  loremIpsum, generatePassword,
  extractEmails, extractUrls, extractNumbers,
  listTransforms, applyTransform, TRANSFORMS,
};
