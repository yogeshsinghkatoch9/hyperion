/**
 * NOVA Language Engine
 * An English-like programming language for controlling your computer.
 * Lexer → Parser → Compiler → Runtime
 */

const { execSync } = require('child_process');
const os = require('os');
const path = require('path');
const { resolveAppName, isBrowser } = require('./appDiscovery');
const windowManager = require('./windowManager');

const HOME = os.homedir();

// ── Helpers ──

function expandPath(p) {
  if (!p) return '';
  return p.replace(/^~/, HOME);
}

function shellEscape(s) {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// Sanitize strings used inside AppleScript double-quoted strings
function osascriptSafe(s) {
  return (s || '').replace(/["\\]/g, '').replace(/[`$]/g, '');
}

// ═══ LEXER ═══

const TOKEN_TYPES = {
  KEYWORD: 'KEYWORD',
  STRING: 'STRING',
  NUMBER: 'NUMBER',
  PATH: 'PATH',
  URL: 'URL',
  IDENTIFIER: 'IDENTIFIER',
  OPERATOR: 'OPERATOR',
  COLON: 'COLON',
  PLUS: 'PLUS',
  NEWLINE: 'NEWLINE',
  COMMENT: 'COMMENT',
  EOF: 'EOF',
};

const KEYWORDS = new Set([
  'set', 'to', 'print', 'show', 'find', 'create', 'delete', 'copy', 'move',
  'read', 'save', 'if', 'end', 'repeat', 'times', 'for', 'each', 'in',
  'open', 'close', 'download', 'ping', 'check', 'wait', 'seconds',
  'file', 'files', 'folder', 'with', 'on', 'all', 'big', 'exists',
  'and', 'or', 'not', 'disk', 'memory', 'cpu', 'usage', 'space',
  'running', 'apps', 'my', 'ip', 'battery', 'system', 'info', 'internet',
  // ── Phase 2-6 new keywords ──
  'at', 'then', 'restart', 'force', 'quit', 'kill',
  'notify', 'alert',
  'minimize', 'fullscreen', 'arrange', 'side', 'by',
  'turn', 'volume', 'mute', 'unmute', 'brightness', 'bluetooth', 'wifi', 'dark', 'mode',
  'every', 'minutes', 'hours', 'daily', 'schedule',
  'say', 'calculate', 'generate', 'password', 'lock', 'sleep',
  'remind', 'type', 'press', 'empty', 'trash',
  'start', 'launch', 'activate', 'workflow',
]);

function tokenize(source) {
  const lines = source.split('\n');
  const tokens = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      tokens.push({ type: TOKEN_TYPES.NEWLINE });
      continue;
    }

    let i = 0;
    while (i < line.length) {
      // Skip whitespace
      if (/\s/.test(line[i])) { i++; continue; }

      // Inline comment
      if (line[i] === '#') break;

      // String literal
      if (line[i] === '"') {
        let str = '';
        i++; // skip opening quote
        while (i < line.length && line[i] !== '"') {
          str += line[i];
          i++;
        }
        i++; // skip closing quote
        tokens.push({ type: TOKEN_TYPES.STRING, value: str });
        continue;
      }

      // Colon
      if (line[i] === ':') {
        tokens.push({ type: TOKEN_TYPES.COLON });
        i++;
        continue;
      }

      // Plus
      if (line[i] === '+') {
        tokens.push({ type: TOKEN_TYPES.PLUS });
        i++;
        continue;
      }

      // Operators
      if (/[><=!]/.test(line[i])) {
        let op = line[i];
        i++;
        if (i < line.length && line[i] === '=') { op += '='; i++; }
        tokens.push({ type: TOKEN_TYPES.OPERATOR, value: op });
        continue;
      }

      // Word or number or path or URL
      let word = '';
      while (i < line.length && !/[\s:+"<>=!]/.test(line[i])) {
        word += line[i];
        i++;
      }

      if (!word) continue;

      // URL
      if (/^https?:\/\//i.test(word)) {
        tokens.push({ type: TOKEN_TYPES.URL, value: word });
      }
      // Path (starts with ~ or / or ./)
      else if (/^[~\/.]/.test(word) && /\//.test(word)) {
        tokens.push({ type: TOKEN_TYPES.PATH, value: word });
      }
      // Number
      else if (/^\d+(\.\d+)?$/.test(word)) {
        tokens.push({ type: TOKEN_TYPES.NUMBER, value: parseFloat(word) });
      }
      // Keyword (case-insensitive)
      else if (KEYWORDS.has(word.toLowerCase())) {
        tokens.push({ type: TOKEN_TYPES.KEYWORD, value: word.toLowerCase() });
      }
      // Identifier
      else {
        tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: word });
      }
    }

    tokens.push({ type: TOKEN_TYPES.NEWLINE });
  }

  tokens.push({ type: TOKEN_TYPES.EOF });
  return tokens;
}

// ═══ PARSER ═══

function parse(tokens) {
  const ast = [];
  let pos = 0;

  function peek() { return tokens[pos] || { type: TOKEN_TYPES.EOF }; }
  function advance() { return tokens[pos++] || { type: TOKEN_TYPES.EOF }; }
  function skipNewlines() { while (peek().type === TOKEN_TYPES.NEWLINE) advance(); }

  function collectUntilNewline() {
    const parts = [];
    while (peek().type !== TOKEN_TYPES.NEWLINE && peek().type !== TOKEN_TYPES.EOF && peek().type !== TOKEN_TYPES.COLON) {
      // Stop at 'then' keyword (acts as line separator for chaining)
      if (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'then') break;
      parts.push(advance());
    }
    return parts;
  }

  function collectBlock() {
    // Expect colon
    if (peek().type === TOKEN_TYPES.COLON) advance();
    skipNewlines();

    const body = [];
    while (pos < tokens.length) {
      skipNewlines();
      const t = peek();
      if (t.type === TOKEN_TYPES.EOF) break;
      if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'end') { advance(); break; }
      const stmt = parseStatement();
      if (stmt) body.push(stmt);
    }
    return body;
  }

  function tokensToString(parts) {
    return parts.map(t => t.value).join(' ');
  }

  function parseStatement() {
    skipNewlines();
    const t = peek();
    if (t.type === TOKEN_TYPES.EOF) return null;
    if (t.type === TOKEN_TYPES.NEWLINE) { advance(); return null; }

    // ── SET variable ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'set') {
      advance();
      const nameToken = advance();
      const name = nameToken.value;
      if (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'to') advance();
      const valueParts = collectUntilNewline();
      const value = valueParts.length === 1 ? valueParts[0] : { type: 'concat', parts: valueParts };
      return { type: 'set', name, value };
    }

    // ── PRINT ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'print') {
      advance();
      const parts = collectUntilNewline();
      return { type: 'print', parts };
    }

    // ── IF ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'if') {
      advance();
      const condParts = collectUntilNewline();
      const body = collectBlock();

      const existsIdx = condParts.findIndex(p => p.value === 'exists');
      if (existsIdx !== -1) {
        const pathParts = condParts.filter(p => p.type === TOKEN_TYPES.PATH);
        const filePath = pathParts[0]?.value || '';
        return { type: 'if', condition: { type: 'exists', path: filePath }, body };
      }

      const opIdx = condParts.findIndex(p => p.type === TOKEN_TYPES.OPERATOR);
      if (opIdx !== -1) {
        const left = tokensToString(condParts.slice(0, opIdx));
        const op = condParts[opIdx].value;
        const right = tokensToString(condParts.slice(opIdx + 1));
        return { type: 'if', condition: { type: 'compare', left, op, right }, body };
      }

      return { type: 'if', condition: { type: 'truthy', expr: tokensToString(condParts) }, body };
    }

    // ── REPEAT ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'repeat') {
      advance();
      const countToken = advance();
      const count = countToken.type === TOKEN_TYPES.NUMBER ? countToken.value : parseInt(countToken.value) || 1;
      if (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'times') advance();
      const body = collectBlock();
      return { type: 'repeat', count, body };
    }

    // ── FOR EACH ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'for') {
      advance();
      if (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'each') advance();
      const varName = advance().value;
      if (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'in') advance();
      const pathToken = advance();
      const dirPath = pathToken.value;
      const body = collectBlock();
      return { type: 'for_each', variable: varName, path: dirPath, body };
    }

    // ── WAIT ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'wait') {
      advance();
      const numToken = advance();
      const secs = numToken.type === TOKEN_TYPES.NUMBER ? numToken.value : parseInt(numToken.value) || 1;
      if (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'seconds') advance();
      collectUntilNewline();
      return { type: 'wait', seconds: secs };
    }

    // ── EVERY / SCHEDULE (Phase 4) ──
    if (t.type === TOKEN_TYPES.KEYWORD && (t.value === 'every' || t.value === 'schedule')) {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ');

      // "every 30 minutes: body" or "every 5 minutes: check internet"
      const intervalMatch = text.match(/^(\d+)\s+(minutes?|hours?|seconds?)$/i);
      if (intervalMatch) {
        const body = collectBlock();
        return {
          type: 'schedule', subtype: 'interval',
          interval: parseInt(intervalMatch[1]),
          unit: intervalMatch[2].toLowerCase().replace(/s$/, ''),
          body,
        };
      }

      // "at 9am: start dev mode"
      const atMatch = text.match(/^at\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
      if (atMatch) {
        const body = collectBlock();
        return { type: 'schedule', subtype: 'cron', time: atMatch[1], body };
      }

      return { type: 'unknown', text: 'every ' + text };
    }

    // ── SAY (text-to-speech) ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'say') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.find(p => p.type === TOKEN_TYPES.STRING)?.value || parts.map(p => p.value).join(' ');
      return { type: 'utility', subtype: 'say', text };
    }

    // ── CALCULATE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'calculate') {
      advance();
      const parts = collectUntilNewline();
      const expr = parts.map(p => {
        if (p.type === TOKEN_TYPES.PLUS) return '+';
        return p.value;
      }).join(' ');
      return { type: 'utility', subtype: 'calculate', expr };
    }

    // ── GENERATE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'generate') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('password')) return { type: 'utility', subtype: 'password' };
      if (text.includes('qr')) {
        const strToken = parts.find(p => p.type === TOKEN_TYPES.STRING || p.type === TOKEN_TYPES.URL);
        return { type: 'utility', subtype: 'qr', data: strToken?.value || text.replace(/qr\s*code\s*(for\s+)?/i, '') };
      }
      return { type: 'unknown', text: 'generate ' + text };
    }

    // ── NOTIFY / ALERT ──
    if (t.type === TOKEN_TYPES.KEYWORD && (t.value === 'notify' || t.value === 'alert')) {
      const isAlert = t.value === 'alert';
      advance();
      const parts = collectUntilNewline();
      const msg = parts.find(p => p.type === TOKEN_TYPES.STRING)?.value || parts.map(p => p.value).join(' ');
      const urgent = isAlert || parts.some(p => p.value === 'urgently');
      return { type: 'notification', message: msg, urgent };
    }

    // ── REMIND ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'remind') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ');
      const match = text.match(/(?:me\s+)?in\s+(\d+)\s+(minutes?|hours?|seconds?)\s+(?:to\s+)?(.+)/i);
      if (match) {
        return { type: 'utility', subtype: 'remind', amount: parseInt(match[1]), unit: match[2], message: match[3] };
      }
      return { type: 'unknown', text: 'remind ' + text };
    }

    // ── TYPE (keyboard sim) ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'type') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.find(p => p.type === TOKEN_TYPES.STRING)?.value || parts.map(p => p.value).join(' ');
      return { type: 'utility', subtype: 'type', text };
    }

    // ── PRESS (keyboard sim) ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'press') {
      advance();
      const parts = collectUntilNewline();
      const combo = parts.map(p => p.value).join('');
      return { type: 'utility', subtype: 'press', combo };
    }

    // ── EMPTY TRASH ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'empty') {
      advance();
      collectUntilNewline(); // consume "trash"
      return { type: 'utility', subtype: 'empty_trash' };
    }

    // ── LOCK / SLEEP ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'lock') {
      advance();
      collectUntilNewline();
      return { type: 'utility', subtype: 'lock' };
    }

    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'sleep' && peek().type !== TOKEN_TYPES.NUMBER) {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('computer') || text.includes('mac') || text.includes('system') || !text) {
        return { type: 'utility', subtype: 'sleep_computer' };
      }
      return { type: 'wait', seconds: 1 }; // fallback
    }

    // ── START/LAUNCH/ACTIVATE workflow ──
    if (t.type === TOKEN_TYPES.KEYWORD && (t.value === 'start' || t.value === 'launch' || t.value === 'activate')) {
      advance();
      const parts = collectUntilNewline();
      let wfName = parts.map(p => p.value).join(' ');
      // Strip trailing "mode" if present
      wfName = wfName.replace(/\s+mode\s*$/i, '').trim();
      return { type: 'workflow', name: wfName };
    }

    // ── RESTART app ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'restart') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('computer') || text.includes('mac') || text.includes('system')) {
        return { type: 'utility', subtype: 'restart_computer' };
      }
      const appName = parts.map(p => p.value).join(' ');
      return { type: 'app', subtype: 'restart_app', name: appName };
    }

    // ── FORCE QUIT ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'force') {
      advance();
      if (peek().type === TOKEN_TYPES.KEYWORD && (peek().value === 'quit' || peek().value === 'kill' || peek().value === 'close')) advance();
      const parts = collectUntilNewline();
      const appName = parts.map(p => p.value).join(' ');
      return { type: 'app', subtype: 'force_quit', name: appName };
    }

    // ── KILL ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'kill') {
      advance();
      const parts = collectUntilNewline();
      const appName = parts.map(p => p.value).join(' ');
      return { type: 'app', subtype: 'force_quit', name: appName };
    }

    // ── TURN on/off (system toggles) ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'turn') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      const onOff = text.startsWith('on') ? true : text.startsWith('off') ? false : null;
      const target = text.replace(/^(on|off)\s+/, '');

      if (onOff !== null) {
        return { type: 'system_toggle', target, enabled: onOff };
      }
      return { type: 'unknown', text: 'turn ' + text };
    }

    // ── VOLUME ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'volume') {
      advance();
      const parts = collectUntilNewline();
      const numToken = parts.find(p => p.type === TOKEN_TYPES.NUMBER);
      if (numToken) return { type: 'system_toggle', target: 'volume', value: numToken.value };
      return { type: 'system_toggle', target: 'volume', value: 50 };
    }

    // ── MUTE / UNMUTE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'mute') {
      advance(); collectUntilNewline();
      return { type: 'system_toggle', target: 'mute', enabled: true };
    }
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'unmute') {
      advance(); collectUntilNewline();
      return { type: 'system_toggle', target: 'mute', enabled: false };
    }

    // ── MINIMIZE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'minimize') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('all')) return { type: 'window', subtype: 'minimize_all' };
      return { type: 'window', subtype: 'minimize', app: parts.map(p => p.value).join(' ') };
    }

    // ── FULLSCREEN ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'fullscreen') {
      advance();
      const parts = collectUntilNewline();
      const appName = parts.map(p => p.value).join(' ');
      return { type: 'window', subtype: 'fullscreen', app: appName };
    }

    // ── ARRANGE side by side ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'arrange') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ');
      const sbs = text.match(/(\w[\w\s]*?)\s+(?:and|&)\s+(\w[\w\s]*?)\s+side\s+by\s+side/i);
      if (sbs) return { type: 'window', subtype: 'side_by_side', app1: sbs[1].trim(), app2: sbs[2].trim() };
      return { type: 'unknown', text: 'arrange ' + text };
    }

    // ── SHOW ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'show') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();

      if (text.includes('files') && text.includes('desktop')) return { type: 'system', subtype: 'show_desktop_files' };
      if (text.includes('big') && text.includes('files')) return { type: 'system', subtype: 'show_big_files' };
      if (text.includes('disk') && text.includes('space')) return { type: 'system', subtype: 'disk_space' };
      if (text.includes('memory') && text.includes('usage')) return { type: 'system', subtype: 'memory_usage' };
      if (text.includes('cpu') && text.includes('usage')) return { type: 'system', subtype: 'cpu_usage' };
      if (text.includes('running') && text.includes('apps')) return { type: 'system', subtype: 'running_apps' };
      if (text.includes('ip')) return { type: 'system', subtype: 'show_ip' };
      if (text.includes('battery')) return { type: 'system', subtype: 'battery' };
      if (text.includes('system') && text.includes('info')) return { type: 'system', subtype: 'system_info' };
      if (text.includes('trash')) return { type: 'utility', subtype: 'trash_size' };
      if (text.includes('files')) {
        const p = parts.find(t => t.type === TOKEN_TYPES.PATH);
        return { type: 'system', subtype: 'list_files', path: p?.value || null };
      }

      return { type: 'system', subtype: 'unknown', text };
    }

    // ── FIND ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'find') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ');
      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      const dir = pathToken?.value || '~';
      const extMatch = text.match(/\b(\w+)\s+files?\b/i);
      const ext = extMatch ? extMatch[1] : '*';
      return { type: 'file_op', subtype: 'find', ext, path: dir };
    }

    // ── CREATE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'create') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      const strToken = parts.find(p => p.type === TOKEN_TYPES.STRING);
      if (text.includes('folder') || text.includes('directory')) {
        return { type: 'file_op', subtype: 'mkdir', path: pathToken?.value || '' };
      }
      return { type: 'file_op', subtype: 'create_file', path: pathToken?.value || '', content: strToken?.value || '' };
    }

    // ── DELETE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'delete') {
      advance();
      const parts = collectUntilNewline();
      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      return { type: 'file_op', subtype: 'delete', path: pathToken?.value || '' };
    }

    // ── COPY ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'copy') {
      advance();
      const parts = collectUntilNewline();
      // Check if clipboard operation
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('clipboard')) {
        const strToken = parts.find(p => p.type === TOKEN_TYPES.STRING);
        return { type: 'utility', subtype: 'copy_clipboard', text: strToken?.value || '' };
      }
      const paths = parts.filter(p => p.type === TOKEN_TYPES.PATH);
      return { type: 'file_op', subtype: 'copy', src: paths[0]?.value || '', dest: paths[1]?.value || '' };
    }

    // ── MOVE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'move') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();

      // Window management: "move chrome to left half"
      const winMatch = text.match(/^(\w[\w\s]*?)\s+to\s+(left half|right half|top half|bottom half|top left|top right|bottom left|bottom right|fullscreen|center)/i);
      if (winMatch) {
        return { type: 'window', subtype: 'move', app: winMatch[1].trim(), position: winMatch[2].trim() };
      }

      const paths = parts.filter(p => p.type === TOKEN_TYPES.PATH);
      return { type: 'file_op', subtype: 'move', src: paths[0]?.value || '', dest: paths[1]?.value || '' };
    }

    // ── READ ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'read') {
      advance();
      const parts = collectUntilNewline();
      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      return { type: 'file_op', subtype: 'read', path: pathToken?.value || '' };
    }

    // ── SAVE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'save') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      // "save clipboard to ~/file"
      if (text.includes('clipboard')) {
        const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
        return { type: 'utility', subtype: 'save_clipboard', path: pathToken?.value || '' };
      }
      const strToken = parts.find(p => p.type === TOKEN_TYPES.STRING);
      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      return { type: 'file_op', subtype: 'save', content: strToken?.value || '', path: pathToken?.value || '' };
    }

    // ── DOWNLOAD ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'download') {
      advance();
      const parts = collectUntilNewline();
      const urlToken = parts.find(p => p.type === TOKEN_TYPES.URL);
      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      return { type: 'network', subtype: 'download', url: urlToken?.value || '', dest: pathToken?.value || '~/Downloads/' };
    }

    // ── PING ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'ping') {
      advance();
      const parts = collectUntilNewline();
      const host = parts[0]?.value || 'google.com';
      return { type: 'network', subtype: 'ping', host };
    }

    // ── CHECK ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'check') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('internet')) return { type: 'network', subtype: 'check_internet' };
      return { type: 'system', subtype: 'unknown', text };
    }

    // ── OPEN ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'open') {
      advance();
      const parts = collectUntilNewline();

      // Check for "with" or "at" token → open app with argument
      const withIdx = parts.findIndex(p => p.type === TOKEN_TYPES.KEYWORD && (p.value === 'with' || p.value === 'at'));
      if (withIdx > 0) {
        const appParts = parts.slice(0, withIdx);
        const argParts = parts.slice(withIdx + 1);
        const appName = appParts.map(p => p.value).join(' ');
        const arg = argParts.find(p => p.type === TOKEN_TYPES.URL)?.value
          || argParts.find(p => p.type === TOKEN_TYPES.PATH)?.value
          || argParts.map(p => p.value).join(' ');
        return { type: 'app', subtype: 'open_app_with', name: appName, argument: arg };
      }

      const pathToken = parts.find(p => p.type === TOKEN_TYPES.PATH);
      if (pathToken) {
        return { type: 'app', subtype: 'open_file', path: pathToken.value };
      }
      const appName = parts.map(p => p.value).filter(v => v !== 'file').join(' ');
      return { type: 'app', subtype: 'open_app', name: appName };
    }

    // ── CLOSE ──
    if (t.type === TOKEN_TYPES.KEYWORD && t.value === 'close') {
      advance();
      const parts = collectUntilNewline();
      const text = parts.map(p => p.value).join(' ').toLowerCase();
      if (text.includes('all') && text.includes('browser')) {
        return { type: 'app', subtype: 'close_all_browsers' };
      }
      const appName = parts.map(p => p.value).join(' ');
      return { type: 'app', subtype: 'close_app', name: appName };
    }

    // Unknown — skip the line
    collectUntilNewline();
    return { type: 'unknown', text: t.value };
  }

  while (pos < tokens.length) {
    skipNewlines();
    if (peek().type === TOKEN_TYPES.EOF) break;
    const stmt = parseStatement();
    if (stmt) ast.push(stmt);
    // Consume 'then' keywords between statements (acts as separator)
    while (peek().type === TOKEN_TYPES.KEYWORD && peek().value === 'then') {
      advance();
      ast.push({ type: '_then_marker' });
    }
  }

  // ── Phase 5: Post-process `then` chaining ──
  const finalAst = [];
  let chainBuf = [];
  for (let i = 0; i < ast.length; i++) {
    const node = ast[i];
    if (node.type === '_then_marker') {
      // Mark that we're building a chain
      continue;
    }
    // Check if previous was a then marker
    if (i > 0 && ast[i - 1]?.type === '_then_marker') {
      chainBuf.push(node);
    } else if (chainBuf.length > 0) {
      // Flush chain
      finalAst.push({ type: 'pipe_chain', steps: chainBuf });
      chainBuf = [node];
    } else {
      // Check if next is then
      if (i + 1 < ast.length && ast[i + 1]?.type === '_then_marker') {
        chainBuf = [node];
      } else {
        finalAst.push(node);
      }
    }
  }
  if (chainBuf.length > 0) {
    if (chainBuf.length === 1) finalAst.push(chainBuf[0]);
    else finalAst.push({ type: 'pipe_chain', steps: chainBuf });
  }

  return finalAst;
}

// ═══ COMPILER ═══

function compile(ast, variables = {}) {
  const results = [];

  function resolveValue(val) {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val.type === TOKEN_TYPES.STRING) return val.value;
    if (val.type === TOKEN_TYPES.NUMBER) return String(val.value);
    if (val.type === TOKEN_TYPES.PATH) return expandPath(val.value);
    if (val.type === TOKEN_TYPES.IDENTIFIER) return variables[val.value] !== undefined ? variables[val.value] : val.value;
    if (val.type === TOKEN_TYPES.KEYWORD) return val.value;
    if (val.type === 'concat') return val.parts.map(resolveValue).join('');
    return val.value || '';
  }

  function resolveParts(parts) {
    if (!parts || !parts.length) return '';
    const segments = [];
    let concatNext = false;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type === TOKEN_TYPES.PLUS) { concatNext = true; continue; }
      const val = resolveValue(parts[i]);
      if (concatNext && segments.length > 0) {
        segments[segments.length - 1] += val;
        concatNext = false;
      } else {
        segments.push(val);
      }
    }
    return segments.join(' ');
  }

  function compileNode(node) {
    switch (node.type) {
      case 'set': {
        const val = typeof node.value === 'object' && node.value.type === 'concat'
          ? node.value.parts.map(resolveValue).join(' ')
          : resolveValue(node.value);
        variables[node.name] = val;
        results.push({ nova: `set ${node.name} to ${val}`, command: `# Variable: ${node.name} = ${val}`, type: 'variable' });
        break;
      }

      case 'print': {
        const text = resolveParts(node.parts);
        results.push({ nova: `print ${text}`, command: `echo ${shellEscape(text)}`, type: 'print' });
        break;
      }

      case 'system': {
        const cmds = {
          show_desktop_files: { cmd: 'ls -la ~/Desktop', desc: 'List files on Desktop' },
          show_big_files: { cmd: 'find ~ -type f -size +100M 2>/dev/null | head -20', desc: 'Find files larger than 100MB' },
          disk_space: { cmd: 'df -h', desc: 'Show disk space usage' },
          memory_usage: { cmd: process.platform === 'darwin' ? 'vm_stat | head -10 && echo "---" && top -l 1 -s 0 | head -8' : 'free -h', desc: 'Show memory usage' },
          cpu_usage: { cmd: process.platform === 'darwin' ? 'top -l 1 -s 0 | head -12' : 'top -bn1 | head -12', desc: 'Show CPU usage' },
          running_apps: { cmd: process.platform === 'darwin' ? 'ps aux --sort=-%mem | head -20' : 'ps aux --sort=-%mem | head -20', desc: 'Show running applications' },
          show_ip: { cmd: 'curl -s ifconfig.me && echo "" && ifconfig | grep "inet " | grep -v 127.0.0.1', desc: 'Show IP addresses' },
          battery: { cmd: process.platform === 'darwin' ? 'pmset -g batt' : 'cat /sys/class/power_supply/BAT0/capacity 2>/dev/null || echo "No battery info"', desc: 'Show battery status' },
          system_info: { cmd: 'uname -a && echo "---" && sw_vers 2>/dev/null || cat /etc/os-release 2>/dev/null', desc: 'Show system information' },
          list_files: { cmd: `ls -la ${expandPath(node.path || '.')}`, desc: `List files in ${node.path || 'current directory'}` },
        };
        const c = cmds[node.subtype] || { cmd: `echo "Unknown: ${node.subtype}"`, desc: node.text || node.subtype };
        results.push({ nova: `show ${node.subtype.replace(/_/g, ' ')}`, command: c.cmd, type: 'system', desc: c.desc });
        break;
      }

      case 'file_op': {
        switch (node.subtype) {
          case 'find':
            results.push({ nova: `find ${node.ext} files in ${node.path}`, command: `find ${shellEscape(expandPath(node.path))} -name ${shellEscape('*.' + node.ext)} -type f 2>/dev/null`, type: 'file', desc: `Find .${node.ext} files` });
            break;
          case 'mkdir':
            results.push({ nova: `create folder ${node.path}`, command: `mkdir -p ${shellEscape(expandPath(node.path))}`, type: 'file', desc: `Create directory ${node.path}` });
            break;
          case 'create_file':
            results.push({ nova: `create file ${node.path}`, command: `echo ${shellEscape(node.content)} > ${shellEscape(expandPath(node.path))}`, type: 'file', desc: `Create file ${node.path}` });
            break;
          case 'delete':
            results.push({ nova: `delete ${node.path}`, command: `rm -i ${shellEscape(expandPath(node.path))}`, type: 'file', desc: `Delete ${node.path}` });
            break;
          case 'copy':
            results.push({ nova: `copy ${node.src} to ${node.dest}`, command: `cp -r ${shellEscape(expandPath(node.src))} ${shellEscape(expandPath(node.dest))}`, type: 'file', desc: `Copy ${node.src} to ${node.dest}` });
            break;
          case 'move':
            results.push({ nova: `move ${node.src} to ${node.dest}`, command: `mv ${shellEscape(expandPath(node.src))} ${shellEscape(expandPath(node.dest))}`, type: 'file', desc: `Move ${node.src} to ${node.dest}` });
            break;
          case 'read':
            results.push({ nova: `read file ${node.path}`, command: `cat ${shellEscape(expandPath(node.path))}`, type: 'file', desc: `Read contents of ${node.path}` });
            break;
          case 'save':
            results.push({ nova: `save to ${node.path}`, command: `echo ${shellEscape(node.content)} > ${shellEscape(expandPath(node.path))}`, type: 'file', desc: `Save to ${node.path}` });
            break;
        }
        break;
      }

      case 'network': {
        switch (node.subtype) {
          case 'download':
            results.push({ nova: `download ${node.url}`, command: `curl -L -o ${shellEscape(expandPath(node.dest))} ${shellEscape(node.url)}`, type: 'network', desc: `Download from ${node.url}` });
            break;
          case 'ping':
            results.push({ nova: `ping ${node.host}`, command: `ping -c 4 ${node.host}`, type: 'network', desc: `Ping ${node.host}` });
            break;
          case 'check_internet':
            results.push({ nova: 'check internet', command: 'curl -s --max-time 5 -o /dev/null -w "%{http_code}" https://www.google.com && echo " — Connected" || echo "No internet"', type: 'network', desc: 'Check internet connectivity' });
            break;
        }
        break;
      }

      case 'app': {
        if (node.subtype === 'open_app') {
          const appName = resolveAppName(node.name);
          const cmd = process.platform === 'darwin'
            ? `open -a ${shellEscape(appName)}`
            : `xdg-open ${shellEscape(appName)} 2>/dev/null || echo "Cannot open ${appName}"`;
          results.push({ nova: `open ${node.name}`, command: cmd, type: 'app', desc: `Open ${appName}` });
        } else if (node.subtype === 'open_app_with') {
          const appName = resolveAppName(node.name);
          let arg = node.argument;
          // Auto-prepend https:// for browser URLs without protocol
          if (isBrowser(appName) && arg && !/^https?:\/\//i.test(arg) && /\.\w+/.test(arg)) {
            arg = 'https://' + arg;
          }
          const cmd = process.platform === 'darwin'
            ? `open -a ${shellEscape(appName)} ${shellEscape(arg)}`
            : `${shellEscape(appName)} ${shellEscape(arg)} 2>/dev/null`;
          results.push({ nova: `open ${node.name} with ${node.argument}`, command: cmd, type: 'app', desc: `Open ${appName} with ${arg}` });
        } else if (node.subtype === 'open_file') {
          const cmd = process.platform === 'darwin'
            ? `open ${shellEscape(expandPath(node.path))}`
            : `xdg-open ${shellEscape(expandPath(node.path))}`;
          results.push({ nova: `open file ${node.path}`, command: cmd, type: 'app', desc: `Open file ${node.path}` });
        } else if (node.subtype === 'close_app') {
          const appName = resolveAppName(node.name);
          const cmd = process.platform === 'darwin'
            ? `osascript -e 'quit app "${osascriptSafe(appName)}"'`
            : `pkill -f ${shellEscape(appName)}`;
          results.push({ nova: `close ${node.name}`, command: cmd, type: 'app', desc: `Close ${appName}` });
        } else if (node.subtype === 'close_all_browsers') {
          const browsers = ['Google Chrome', 'Firefox', 'Safari', 'Brave Browser', 'Microsoft Edge', 'Arc'];
          const cmd = browsers.map(b =>
            process.platform === 'darwin' ? `osascript -e 'quit app "${osascriptSafe(b)}"' 2>/dev/null` : `pkill -f "${b}" 2>/dev/null`
          ).join('; ');
          results.push({ nova: 'close all browsers', command: cmd, type: 'app', desc: 'Close all browser applications' });
        } else if (node.subtype === 'restart_app') {
          const appName = resolveAppName(node.name);
          const cmd = process.platform === 'darwin'
            ? `osascript -e 'quit app "${osascriptSafe(appName)}"' && sleep 1 && open -a ${shellEscape(appName)}`
            : `pkill -f ${shellEscape(appName)} && sleep 1 && ${shellEscape(appName)} &`;
          results.push({ nova: `restart ${node.name}`, command: cmd, type: 'app', desc: `Restart ${appName}` });
        } else if (node.subtype === 'force_quit') {
          const appName = resolveAppName(node.name);
          results.push({ nova: `force quit ${node.name}`, command: `pkill -9 -f ${shellEscape(appName)}`, type: 'app', desc: `Force quit ${appName}` });
        }
        break;
      }

      case 'notification': {
        const sound = node.urgent ? ' sound name "Funk"' : '';
        const safeMsg = osascriptSafe(node.message);
        const cmd = process.platform === 'darwin'
          ? `osascript -e 'display notification "${safeMsg}" with title "Hyperion"${sound}'`
          : `notify-send "Hyperion" "${safeMsg}"`;
        results.push({ nova: `notify "${node.message}"`, command: cmd, type: 'app', desc: `Show notification` });
        break;
      }

      case 'window': {
        let cmd;
        if (node.subtype === 'move') {
          const appName = resolveAppName(node.app);
          cmd = windowManager.moveWindowScript(appName, node.position);
        } else if (node.subtype === 'fullscreen') {
          const appName = resolveAppName(node.app);
          cmd = windowManager.moveWindowScript(appName, 'fullscreen');
        } else if (node.subtype === 'minimize_all') {
          cmd = windowManager.minimizeAll();
        } else if (node.subtype === 'side_by_side') {
          const app1 = resolveAppName(node.app1);
          const app2 = resolveAppName(node.app2);
          cmd = windowManager.sideBySide(app1, app2);
        } else {
          cmd = `echo "Unknown window operation"`;
        }
        results.push({ nova: `window: ${node.subtype}`, command: cmd, type: 'system', desc: `Window: ${node.subtype}` });
        break;
      }

      case 'system_toggle': {
        let cmd;
        const target = node.target;
        if (target === 'dark mode' || target === 'darkmode') {
          cmd = process.platform === 'darwin'
            ? `osascript -e 'tell application "System Events" to tell appearance preferences to set dark mode to ${node.enabled}'`
            : `echo "Dark mode toggle on ${process.platform}"`;
        } else if (target === 'wifi' || target === 'wi-fi') {
          cmd = process.platform === 'darwin'
            ? `networksetup -setairportpower en0 ${node.enabled ? 'on' : 'off'}`
            : `nmcli radio wifi ${node.enabled ? 'on' : 'off'}`;
        } else if (target === 'bluetooth') {
          cmd = process.platform === 'darwin'
            ? `blueutil --power ${node.enabled ? '1' : '0'} 2>/dev/null || echo "Install blueutil: brew install blueutil"`
            : `rfkill ${node.enabled ? 'unblock' : 'block'} bluetooth`;
        } else if (target === 'volume') {
          const vol = Math.min(100, Math.max(0, node.value || 50));
          cmd = process.platform === 'darwin'
            ? `osascript -e 'set volume output volume ${vol}'`
            : `amixer set Master ${vol}%`;
        } else if (target === 'mute') {
          cmd = process.platform === 'darwin'
            ? `osascript -e 'set volume ${node.enabled ? 'with' : 'without'} output muted'`
            : `amixer set Master ${node.enabled ? 'mute' : 'unmute'}`;
        } else {
          cmd = `echo "Unknown toggle: ${target}"`;
        }
        results.push({ nova: `toggle ${target}`, command: cmd, type: 'system', desc: `System: ${target} ${node.enabled !== undefined ? (node.enabled ? 'on' : 'off') : node.value}` });
        break;
      }

      case 'utility': {
        let cmd;
        switch (node.subtype) {
          case 'say':
            cmd = `say ${shellEscape(node.text)}`; break;
          case 'calculate': {
            let expr = node.expr.replace(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/g, '($1/100)*$2');
            expr = expr.replace(/[^0-9+\-*/().%^ \t]/g, '');
            cmd = expr.trim() ? `python3 -c "print(${expr})"` : `echo "Invalid expression"`; break;
          }
          case 'password':
            cmd = `openssl rand -base64 24 | head -c 32 && echo ""`; break;
          case 'qr':
            cmd = `qrencode -o ~/Desktop/qr_$(date +%s).png ${shellEscape(node.data)} 2>/dev/null && echo "QR saved to Desktop" || echo "Install: brew install qrencode"`; break;
          case 'empty_trash':
            cmd = process.platform === 'darwin'
              ? `osascript -e 'tell application "Finder" to empty trash'`
              : `rm -rf ~/.local/share/Trash/files/*`; break;
          case 'trash_size':
            cmd = `du -sh ~/.Trash 2>/dev/null || echo "No trash"`;  break;
          case 'lock':
            cmd = process.platform === 'darwin' ? `pmset displaysleepnow` : `loginctl lock-session`; break;
          case 'sleep_computer':
            cmd = process.platform === 'darwin' ? `pmset sleepnow` : `systemctl suspend`; break;
          case 'restart_computer':
            cmd = process.platform === 'darwin'
              ? `osascript -e 'tell application "System Events" to restart'`
              : `systemctl reboot`; break;
          case 'remind': {
            let secs = node.amount;
            if (node.unit.startsWith('minute')) secs *= 60;
            else if (node.unit.startsWith('hour')) secs *= 3600;
            const safeReminderMsg = osascriptSafe(node.message);
            const notifyCmd = process.platform === 'darwin'
              ? `osascript -e 'display notification "${safeReminderMsg}" with title "Reminder" sound name "Glass"'`
              : `notify-send "Reminder" "${safeReminderMsg}"`;
            cmd = `(sleep ${secs} && ${notifyCmd}) & echo "Reminder set: ${safeReminderMsg} in ${node.amount} ${node.unit}"`; break;
          }
          case 'type':
            cmd = process.platform === 'darwin'
              ? `osascript -e 'tell application "System Events" to keystroke "${osascriptSafe(node.text)}"'`
              : `xdotool type "${osascriptSafe(node.text)}"`; break;
          case 'press':
            cmd = `osascript -e 'tell application "System Events" to keystroke "${osascriptSafe(node.combo)}"'`; break;
          case 'copy_clipboard':
            cmd = process.platform === 'darwin'
              ? `echo -n ${shellEscape(node.text)} | pbcopy && echo "Copied to clipboard"`
              : `echo -n ${shellEscape(node.text)} | xclip -sel clip`; break;
          case 'save_clipboard':
            cmd = process.platform === 'darwin'
              ? `pbpaste > ${shellEscape(expandPath(node.path))}`
              : `xclip -sel clip -o > ${shellEscape(expandPath(node.path))}`; break;
          default:
            cmd = `echo "Unknown utility: ${node.subtype}"`;
        }
        results.push({ nova: `${node.subtype}`, command: cmd, type: 'system', desc: `Utility: ${node.subtype}` });
        break;
      }

      case 'schedule': {
        // Scheduling doesn't execute — returns metadata for agent creation
        const bodyCompiled = compile(node.body, variables);
        const bodyCommands = bodyCompiled.map(r => r.command).filter(c => c && !c.startsWith('#')).join(' && ');
        results.push({
          nova: node.subtype === 'interval' ? `every ${node.interval} ${node.unit}` : `at ${node.time}`,
          command: `# Schedule: ${node.subtype === 'interval' ? `every ${node.interval} ${node.unit}` : `at ${node.time}`}`,
          type: 'schedule',
          desc: `Scheduled task`,
          agentData: {
            type: node.subtype,
            interval: node.interval,
            unit: node.unit,
            time: node.time,
            command: bodyCommands,
            bodySteps: bodyCompiled,
          },
        });
        break;
      }

      case 'workflow': {
        // Workflow execution — returns a special result that the route handler will intercept
        results.push({
          nova: `start ${node.name} mode`,
          command: null,
          type: 'workflow',
          desc: `Execute workflow: ${node.name}`,
          workflowName: node.name,
        });
        break;
      }

      case 'pipe_chain': {
        // Compile each step and join with &&
        const stepCmds = [];
        for (const step of node.steps) {
          const stepResults = compile([step], variables);
          for (const r of stepResults) {
            if (r.command && !r.command.startsWith('#')) {
              stepCmds.push(r.command);
            }
          }
        }
        const chained = stepCmds.join(' && ');
        results.push({
          nova: node.steps.map(s => s.type).join(' then '),
          command: chained,
          type: 'system',
          desc: `Chained: ${node.steps.length} steps`,
        });
        break;
      }

      case 'wait': {
        results.push({ nova: `wait ${node.seconds} seconds`, command: `sleep ${node.seconds}`, type: 'wait', desc: `Pause for ${node.seconds} seconds` });
        break;
      }

      case 'if': {
        let testCmd;
        const cond = node.condition;
        if (cond.type === 'exists') {
          testCmd = `test -e ${shellEscape(expandPath(cond.path))}`;
          results.push({ nova: `if ${cond.path} exists`, command: testCmd, type: 'condition', desc: `Check if ${cond.path} exists` });
        } else if (cond.type === 'compare') {
          const left = cond.left.split(' ').map(w => variables[w] !== undefined ? variables[w] : w).join(' ');
          testCmd = `# if ${left} ${cond.op} ${cond.right}`;
          if (cond.left.includes('disk')) {
            testCmd = `[ $(df -h / | awk 'NR==2{print int($5)}') ${cond.op === '>' ? '-gt' : '-lt'} ${cond.right} ]`;
          }
          results.push({ nova: `if ${cond.left} ${cond.op} ${cond.right}`, command: testCmd, type: 'condition', desc: `Condition: ${cond.left} ${cond.op} ${cond.right}` });
        }
        const bodyResults = compile(node.body, variables);
        results.push(...bodyResults.map(r => ({ ...r, conditional: true })));
        break;
      }

      case 'repeat': {
        const MAX_REPEAT = 1000;
        const safeCount = Math.min(node.count, MAX_REPEAT);
        if (node.count > MAX_REPEAT) {
          results.push({ nova: `repeat ${node.count} times`, command: `# WARNING: repeat capped at ${MAX_REPEAT} (requested ${node.count})`, type: 'loop', desc: `Repeat capped at ${MAX_REPEAT}` });
        }
        results.push({ nova: `repeat ${safeCount} times`, command: `# Loop ${safeCount} times`, type: 'loop', desc: `Repeat ${safeCount} times` });
        for (let i = 0; i < safeCount; i++) {
          const iterResults = compile(node.body, variables);
          results.push(...iterResults.map(r => ({ ...r, iteration: i + 1 })));
        }
        break;
      }

      case 'for_each': {
        results.push({ nova: `for each ${node.variable} in ${node.path}`, command: `ls ${expandPath(node.path)}`, type: 'loop', desc: `Iterate over files in ${node.path}` });
        results.push({ type: 'for_each_exec', variable: node.variable, path: expandPath(node.path), body: node.body, nova: `  (iterate body for each file)` });
        break;
      }

      default:
        if (node.text) {
          results.push({ nova: node.text, command: `# Unknown: ${node.text}`, type: 'unknown' });
        }
    }
  }

  for (const node of ast) {
    compileNode(node);
  }

  return results;
}

// ═══ RUNTIME ═══

function run(source) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  const variables = {};
  const compiled = compile(ast, variables);
  const output = [];

  for (const step of compiled) {
    const entry = {
      nova: step.nova || '',
      command: step.command || '',
      desc: step.desc || '',
      type: step.type || 'unknown',
      // Preserve extra metadata for route handlers
      ...(step.workflowName ? { workflowName: step.workflowName } : {}),
      ...(step.agentData ? { agentData: step.agentData } : {}),
    };

    if (step.type === 'variable') {
      entry.result = `Variable set`;
      entry.exitCode = 0;
      output.push(entry);
      continue;
    }

    // Schedule steps don't execute — return agentData
    if (step.type === 'schedule') {
      entry.result = `Schedule registered (use agents to activate)`;
      entry.exitCode = 0;
      entry.agentData = step.agentData;
      output.push(entry);
      continue;
    }

    if (step.type === 'for_each_exec') {
      try {
        const files = execSync(`ls ${shellEscape(step.path)}`, { encoding: 'utf8', timeout: 10000 }).trim().split('\n').filter(Boolean);
        for (const file of files) {
          variables[step.variable] = file;
          const bodyCompiled = compile(step.body, variables);
          for (const bs of bodyCompiled) {
            try {
              const result = execSync(bs.command, { encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'] });
              output.push({ nova: bs.nova, command: bs.command, desc: bs.desc, type: bs.type, result: result.trim(), exitCode: 0 });
            } catch (err) {
              output.push({ nova: bs.nova, command: bs.command, desc: bs.desc, type: bs.type, result: err.stderr?.toString() || err.message, exitCode: err.status || 1 });
            }
          }
        }
      } catch (err) {
        entry.result = err.stderr?.toString() || err.message;
        entry.exitCode = 1;
        output.push(entry);
      }
      continue;
    }

    if (step.type === 'condition') {
      try {
        execSync(step.command, { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'] });
        entry.result = 'true';
        entry.exitCode = 0;
      } catch {
        entry.result = 'false';
        entry.exitCode = 1;
      }
      output.push(entry);
      continue;
    }

    if (step.conditional) {
      const lastCond = output.filter(o => o.type === 'condition').pop();
      if (lastCond && lastCond.exitCode !== 0) {
        entry.result = '(skipped — condition was false)';
        entry.exitCode = -1;
        output.push(entry);
        continue;
      }
    }

    // Skip null commands (workflow / schedule — handled by route)
    if (!step.command) {
      output.push(entry);
      continue;
    }

    // Skip comment-only commands
    if (step.command.startsWith('#')) {
      entry.result = '';
      entry.exitCode = 0;
      output.push(entry);
      continue;
    }

    // Execute the command
    try {
      const result = execSync(step.command, {
        encoding: 'utf8',
        timeout: 30000,
        cwd: os.homedir(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      entry.result = result.trim();
      entry.exitCode = 0;
    } catch (err) {
      entry.result = (err.stdout?.toString() || '') + (err.stderr?.toString() || err.message);
      entry.exitCode = err.status || 1;
    }

    output.push(entry);
  }

  return output;
}

// ═══ EXPLAIN (compile without executing) ═══

function explain(source) {
  const tokens = tokenize(source);
  const ast = parse(tokens);
  const variables = {};
  return compile(ast, variables);
}

// ═══ EXAMPLES ═══

const EXAMPLES = [
  {
    name: 'Hello World',
    description: 'A simple greeting program',
    code: `# My first NOVA program
set name to "World"
print "Hello, " + name + "!"
print "Welcome to NOVA."`,
  },
  {
    name: 'Desktop Explorer',
    description: 'Browse and inspect your Desktop',
    code: `# Show what's on the Desktop
show files on desktop
show big files
show disk space`,
  },
  {
    name: 'System Check',
    description: 'Quick system health check',
    code: `# System health report
print "=== System Report ==="
show system info
show memory usage
show cpu usage
show battery
show my ip`,
  },
  {
    name: 'File Operations',
    description: 'Create, read, and manage files',
    code: `# File management demo
create folder ~/Desktop/nova-test
create file ~/Desktop/nova-test/hello.txt with "Hello from NOVA!"
read file ~/Desktop/nova-test/hello.txt
show files on desktop`,
  },
  {
    name: 'Conditions',
    description: 'Use if/end blocks',
    code: `# Conditional logic
if file ~/Desktop exists:
    print "Desktop folder found!"
    show files on desktop
end

if disk usage > 80:
    print "Warning: disk is getting full!"
end`,
  },
  {
    name: 'Loops',
    description: 'Repeat actions multiple times',
    code: `# Loop examples
repeat 3 times:
    print "NOVA is awesome!"
end

print "---"
print "Files on Desktop:"
for each file in ~/Desktop:
    print file
end`,
  },
  {
    name: 'Network Tools',
    description: 'Check connectivity and download',
    code: `# Network utilities
check internet
ping google.com
show my ip`,
  },
  {
    name: 'App Control',
    description: 'Open, close, and manage apps',
    code: `# App management
open chrome with google.com
wait 2 seconds
open vscode
notify "Apps are ready!"`,
  },
  {
    name: 'System Toggles',
    description: 'Control system settings',
    code: `# System control
turn on dark mode
volume 50
say "System configured"
show battery`,
  },
  {
    name: 'Creative Utilities',
    description: 'Passwords, math, and more',
    code: `# Utility showcase
generate password
calculate 15 % of 2400
show trash size
say "Hello from NOVA!"`,
  },
];

module.exports = { tokenize, parse, compile, run, explain, EXAMPLES };
