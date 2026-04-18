/**
 * Benchmark Tools — Extended tool set for SWE-bench, WebArena, GAIA benchmarks
 * Part of Tier 5: Benchmark-Ready Agent
 *
 * New tools:
 *  - patch_file: Apply unified diff
 *  - search_and_replace: Regex find-replace in files
 *  - read_file_range: Read specific line range
 *  - browser_navigate, browser_click, browser_type, browser_screenshot, browser_extract
 *  - run_tests: Auto-detect framework and execute
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const browser = require('./browserControl');
const agent = require('./agentLoop');

const HOME = os.homedir();
const TOOL_TIMEOUT = 30000;

// ── Tool Definitions ──
const BENCHMARK_TOOLS = [
  {
    name: 'patch_file',
    description: 'Apply a unified diff patch to a file. For precise code changes without rewriting the full file.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to patch' },
        patch: { type: 'string', description: 'Unified diff content (lines starting with +/-/space)' },
      },
      required: ['path', 'patch'],
    },
  },
  {
    name: 'search_and_replace',
    description: 'Find and replace text in a file using regex patterns.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        search: { type: 'string', description: 'Regex pattern to search for' },
        replace: { type: 'string', description: 'Replacement string (supports $1, $2 backreferences)' },
        flags: { type: 'string', description: 'Regex flags (default: g)' },
      },
      required: ['path', 'search', 'replace'],
    },
  },
  {
    name: 'read_file_range',
    description: 'Read specific line range from a file. Useful for large files.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        startLine: { type: 'number', description: 'Start line (1-indexed)' },
        endLine: { type: 'number', description: 'End line (1-indexed, inclusive)' },
      },
      required: ['path', 'startLine', 'endLine'],
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate the browser to a URL. Launches Chrome headless if not running.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element in the browser by CSS selector.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the element to click' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into a focused element in the browser.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of the input element' },
        text: { type: 'string', description: 'Text to type' },
      },
      required: ['selector', 'text'],
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take a screenshot of the current browser page. Returns base64 PNG.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'browser_extract',
    description: 'Extract content from the current browser page using a CSS selector or JavaScript expression.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector to extract text from' },
        js: { type: 'string', description: 'JavaScript expression to evaluate (alternative to selector)' },
      },
    },
  },
  {
    name: 'run_tests',
    description: 'Auto-detect test framework (vitest/jest/pytest/mocha) and run tests. Returns pass/fail results.',
    parameters: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Working directory (default: home)' },
        filter: { type: 'string', description: 'Test file/pattern filter' },
        framework: { type: 'string', enum: ['auto', 'vitest', 'jest', 'pytest', 'mocha', 'npm'], description: 'Test framework (default: auto-detect)' },
      },
    },
  },
];

// ── Tool Executors ─��
const benchmarkExecutors = {
  async patch_file({ path: filePath, patch }) {
    const resolved = agent.resolveSafePath(filePath);
    if (!agent.isPathSafe(resolved)) return { error: 'Path outside home directory' };

    try {
      if (!fs.existsSync(resolved)) return { error: `File not found: ${resolved}` };

      const original = fs.readFileSync(resolved, 'utf8');
      const lines = original.split('\n');
      const patchLines = patch.split('\n');

      // Simple unified diff applier
      let lineOffset = 0;
      const result = [...lines];
      let currentLine = 0;

      for (const pl of patchLines) {
        // Skip diff headers
        if (pl.startsWith('---') || pl.startsWith('+++') || pl.startsWith('diff')) continue;

        // Parse hunk header
        const hunkMatch = pl.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunkMatch) {
          currentLine = parseInt(hunkMatch[1]) - 1 + lineOffset;
          continue;
        }

        if (pl.startsWith('-')) {
          // Remove line
          if (currentLine < result.length) {
            result.splice(currentLine, 1);
            lineOffset--;
          }
        } else if (pl.startsWith('+')) {
          // Add line
          result.splice(currentLine, 0, pl.slice(1));
          currentLine++;
          lineOffset++;
        } else if (pl.startsWith(' ') || pl === '') {
          // Context line — advance
          currentLine++;
        }
      }

      fs.writeFileSync(resolved, result.join('\n'), 'utf8');
      return { ok: true, path: resolved, linesChanged: Math.abs(lineOffset), totalLines: result.length };
    } catch (err) {
      return { error: err.message };
    }
  },

  async search_and_replace({ path: filePath, search, replace, flags }) {
    const resolved = agent.resolveSafePath(filePath);
    if (!agent.isPathSafe(resolved)) return { error: 'Path outside home directory' };

    try {
      const content = fs.readFileSync(resolved, 'utf8');
      const regex = new RegExp(search, flags || 'g');
      const matches = content.match(regex);
      const newContent = content.replace(regex, replace);

      if (newContent === content) return { ok: true, replacements: 0, path: resolved };

      fs.writeFileSync(resolved, newContent, 'utf8');
      return { ok: true, replacements: matches?.length || 0, path: resolved };
    } catch (err) {
      return { error: err.message };
    }
  },

  async read_file_range({ path: filePath, startLine, endLine }) {
    const resolved = agent.resolveSafePath(filePath);

    try {
      const content = fs.readFileSync(resolved, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(0, (startLine || 1) - 1);
      const end = Math.min(lines.length, endLine || lines.length);
      const slice = lines.slice(start, end);

      return {
        content: slice.join('\n'),
        path: resolved,
        startLine: start + 1,
        endLine: end,
        totalLines: lines.length,
      };
    } catch (err) {
      return { error: err.message };
    }
  },

  async browser_navigate({ url }) {
    try {
      if (!browser.isRunning()) await browser.launch();
      const result = await browser.navigate(url);
      const info = await browser.getPageInfo();
      return { ok: true, url: info.url, title: info.title };
    } catch (err) {
      return { error: err.message };
    }
  },

  async browser_click({ selector }) {
    try {
      if (!browser.isRunning()) return { error: 'Browser not running. Use browser_navigate first.' };
      const result = await browser.click(selector);
      return { ok: true, ...result };
    } catch (err) {
      return { error: err.message };
    }
  },

  async browser_type({ selector, text }) {
    try {
      if (!browser.isRunning()) return { error: 'Browser not running. Use browser_navigate first.' };
      const result = await browser.type(selector, text);
      return { ok: true, ...result };
    } catch (err) {
      return { error: err.message };
    }
  },

  async browser_screenshot() {
    try {
      if (!browser.isRunning()) return { error: 'Browser not running. Use browser_navigate first.' };
      const base64 = await browser.screenshot();
      return { ok: true, format: 'png', data: base64.slice(0, 200) + '... (truncated)', size: base64.length };
    } catch (err) {
      return { error: err.message };
    }
  },

  async browser_extract({ selector, js }) {
    try {
      if (!browser.isRunning()) return { error: 'Browser not running. Use browser_navigate first.' };

      if (js) {
        const result = await browser.evaluate(js);
        return { ok: true, result };
      }

      if (selector) {
        const result = await browser.evaluate(
          `(() => {
            const els = document.querySelectorAll('${selector.replace(/'/g, "\\'")}');
            return Array.from(els).map(el => ({
              text: el.textContent?.trim().slice(0, 500),
              tag: el.tagName,
              href: el.href || null,
              value: el.value || null,
            })).slice(0, 20);
          })()`
        );
        return { ok: true, elements: result || [] };
      }

      return { error: 'Provide either selector or js parameter' };
    } catch (err) {
      return { error: err.message };
    }
  },

  async run_tests({ cwd, filter, framework }) {
    const dir = cwd ? agent.resolveSafePath(cwd) : HOME;
    const fw = framework || 'auto';

    try {
      let detected = fw;

      if (fw === 'auto') {
        // Auto-detect test framework
        const pkgPath = path.join(dir, 'package.json');
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          const deps = { ...pkg.devDependencies, ...pkg.dependencies };
          if (deps.vitest) detected = 'vitest';
          else if (deps.jest) detected = 'jest';
          else if (deps.mocha) detected = 'mocha';
          else if (pkg.scripts?.test) detected = 'npm';
        }
        // Check for Python
        if (detected === 'auto') {
          if (fs.existsSync(path.join(dir, 'pytest.ini')) ||
              fs.existsSync(path.join(dir, 'setup.py')) ||
              fs.existsSync(path.join(dir, 'pyproject.toml'))) {
            detected = 'pytest';
          }
        }
        if (detected === 'auto') detected = 'npm';
      }

      const commands = {
        vitest: `npx vitest run ${filter || ''} --reporter=verbose 2>&1`,
        jest: `npx jest ${filter || ''} --verbose 2>&1`,
        mocha: `npx mocha ${filter || ''} --reporter spec 2>&1`,
        pytest: `python -m pytest ${filter || ''} -v 2>&1`,
        npm: 'npm test 2>&1',
      };

      const cmd = commands[detected];
      if (!cmd) return { error: `Unknown framework: ${detected}` };

      const output = execSync(cmd, {
        cwd: dir,
        encoding: 'utf8',
        timeout: 120000,
        maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, HOME, CI: 'true' },
      });

      const { passed, failed, total } = _parseTestOutput(output, detected);

      return {
        ok: true,
        framework: detected,
        passed,
        failed,
        total,
        output: output.slice(-3000), // Last 3000 chars
      };
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      const { passed, failed, total } = _parseTestOutput(output, fw);

      return {
        ok: false,
        framework: fw,
        passed,
        failed,
        total,
        exitCode: err.status || 1,
        output: output.slice(-3000),
      };
    }
  },
};

/**
 * Parse test output for pass/fail counts.
 */
function _parseTestOutput(output, framework) {
  let passed = 0, failed = 0, total = 0;

  // Jest/Vitest pattern: "Tests: X passed, Y failed, Z total"
  const jestMatch = output.match(/Tests:\s+(\d+)\s+passed.*?(\d+)\s+failed.*?(\d+)\s+total/i)
    || output.match(/Tests:\s+(\d+)\s+passed.*?(\d+)\s+total/i);
  if (jestMatch) {
    passed = parseInt(jestMatch[1]);
    failed = parseInt(jestMatch[2] || '0');
    total = parseInt(jestMatch[3] || jestMatch[2]);
    return { passed, failed, total };
  }

  // Pytest pattern: "X passed, Y failed" or "X passed"
  const pytestMatch = output.match(/(\d+)\s+passed/);
  const pytestFail = output.match(/(\d+)\s+failed/);
  if (pytestMatch) {
    passed = parseInt(pytestMatch[1]);
    failed = pytestFail ? parseInt(pytestFail[1]) : 0;
    total = passed + failed;
    return { passed, failed, total };
  }

  // Mocha pattern: "X passing" "Y failing"
  const mochaPass = output.match(/(\d+)\s+passing/);
  const mochaFail = output.match(/(\d+)\s+failing/);
  if (mochaPass) {
    passed = parseInt(mochaPass[1]);
    failed = mochaFail ? parseInt(mochaFail[1]) : 0;
    total = passed + failed;
    return { passed, failed, total };
  }

  return { passed, failed, total };
}

// ── Approval Rules for Benchmark Tools ──
const BENCHMARK_APPROVAL_RULES = {
  patch_file: 'always',
  search_and_replace: 'always',
  read_file_range: 'never',
  browser_navigate: 'never',
  browser_click: 'never',
  browser_type: 'never',
  browser_screenshot: 'never',
  browser_extract: 'never',
  run_tests: 'never',
};

module.exports = {
  BENCHMARK_TOOLS,
  benchmarkExecutors,
  BENCHMARK_APPROVAL_RULES,
};
