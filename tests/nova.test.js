/**
 * NOVA Language Engine Tests — Lexer, Parser, Compiler, Explain, Examples
 * NOTE: run() executes real shell commands, so only safe subsets are tested.
 */
import { describe, test, expect, vi } from 'vitest';

vi.mock('../services/appDiscovery', () => ({
  resolveAppName: (name) => name,
  isBrowser: (name) => /chrome|safari|firefox|brave|edge|arc/i.test(name),
}));

vi.mock('../services/windowManager', () => ({
  moveWindowScript: (app, pos) => `# move ${app} to ${pos}`,
  minimizeAll: () => '# minimize all',
  sideBySide: (a, b) => `# side-by-side ${a} ${b}`,
}));

const { tokenize, parse, compile, explain, EXAMPLES } = await import('../services/nova.js');

describe('Lexer', () => {
  test('tokenizes keywords', () => {
    const tokens = tokenize('set print show find create delete');
    const kw = tokens.filter(t => t.type === 'KEYWORD');
    expect(kw.map(k => k.value)).toEqual(['set', 'print', 'show', 'find', 'create', 'delete']);
  });

  test('keywords are case-insensitive', () => {
    const tokens = tokenize('SET Print');
    const kw = tokens.filter(t => t.type === 'KEYWORD');
    expect(kw.map(k => k.value)).toEqual(['set', 'print']);
  });

  test('strings, numbers, paths', () => {
    const t1 = tokenize('print "hello"');
    expect(t1.find(t => t.type === 'STRING').value).toBe('hello');

    const t2 = tokenize('repeat 5 times');
    expect(t2.find(t => t.type === 'NUMBER').value).toBe(5);

    const t3 = tokenize('read ~/test.txt');
    expect(t3.find(t => t.type === 'PATH').value).toBe('~/test.txt');
  });

  test('operators, colons, plus, newlines', () => {
    expect(tokenize('if x > 10').find(t => t.type === 'OPERATOR').value).toBe('>');
    expect(tokenize('if true:').filter(t => t.type === 'COLON')).toHaveLength(1);
    expect(tokenize('"a" + "b"').filter(t => t.type === 'PLUS')).toHaveLength(1);
    expect(tokenize('a\nb').filter(t => t.type === 'NEWLINE').length).toBeGreaterThanOrEqual(2);
  });

  test('comments excluded, EOF always present', () => {
    const t = tokenize('# comment only');
    expect(t.filter(t => t.type !== 'NEWLINE' && t.type !== 'EOF')).toHaveLength(0);
    expect(t[t.length - 1].type).toBe('EOF');
  });

  test('empty and whitespace input', () => {
    expect(tokenize('')[tokenize('').length - 1].type).toBe('EOF');
    const ws = tokenize('   \n   ');
    expect(ws.filter(t => t.type !== 'NEWLINE' && t.type !== 'EOF')).toHaveLength(0);
  });
});

describe('Parser', () => {
  test('set statement', () => {
    const ast = parse(tokenize('set name to "Alice"'));
    expect(ast).toHaveLength(1);
    expect(ast[0].type).toBe('set');
    expect(ast[0].name).toBe('name');
  });

  test('print statement', () => {
    const ast = parse(tokenize('print "Hello"'));
    expect(ast).toHaveLength(1);
    expect(ast[0].type).toBe('print');
  });

  test('if/end with exists', () => {
    const ast = parse(tokenize('if file ~/Desktop exists:\n  print "yes"\nend'));
    expect(ast[0].type).toBe('if');
    expect(ast[0].condition.type).toBe('exists');
    expect(ast[0].body).toHaveLength(1);
  });

  test('if with comparison', () => {
    const ast = parse(tokenize('if disk usage > 80:\n  print "full"\nend'));
    expect(ast[0].condition.type).toBe('compare');
    expect(ast[0].condition.op).toBe('>');
  });

  test('repeat N times', () => {
    const ast = parse(tokenize('repeat 3 times:\n  print "go"\nend'));
    expect(ast[0].type).toBe('repeat');
    expect(ast[0].count).toBe(3);
    expect(ast[0].body).toHaveLength(1);
  });

  test('for each', () => {
    const ast = parse(tokenize('for each file in ~/Desktop:\n  print file\nend'));
    expect(ast[0].type).toBe('for_each');
    expect(ast[0].variable).toBe('file');
  });

  test('system commands', () => {
    expect(parse(tokenize('show disk space'))[0].subtype).toBe('disk_space');
    expect(parse(tokenize('show running apps'))[0].subtype).toBe('running_apps');
  });

  test('file ops', () => {
    expect(parse(tokenize('create folder ~/test'))[0].subtype).toBe('mkdir');
    expect(parse(tokenize('delete ~/temp.txt'))[0].subtype).toBe('delete');
    expect(parse(tokenize('copy ~/a.txt ~/b.txt'))[0].subtype).toBe('copy');
  });

  test('app, wait, notify', () => {
    expect(parse(tokenize('open chrome'))[0].subtype).toBe('open_app');
    expect(parse(tokenize('wait 5 seconds'))[0].seconds).toBe(5);
    expect(parse(tokenize('notify "done"'))[0].urgent).toBe(false);
    expect(parse(tokenize('alert "fail"'))[0].urgent).toBe(true);
  });

  test('multi-line program', () => {
    const ast = parse(tokenize('set x to 10\nprint "hi"\nshow disk space'));
    expect(ast).toHaveLength(3);
  });
});

describe('Compiler', () => {
  test('print → echo', () => {
    const r = compile(parse(tokenize('print "hello"')));
    expect(r[0].command).toMatch(/^echo /);
    expect(r[0].type).toBe('print');
  });

  test('set stores variable', () => {
    const vars = {};
    compile(parse(tokenize('set x to "hi"')), vars);
    expect(vars.x).toBe('hi');
  });

  test('variable substitution', () => {
    const r = compile(parse(tokenize('set name to "Nova"\nprint name')));
    expect(r[1].command).toContain('Nova');
  });

  test('file ops → shell commands', () => {
    expect(compile(parse(tokenize('create folder ~/test')))[0].command).toMatch(/mkdir -p/);
    expect(compile(parse(tokenize('delete ~/t.txt')))[0].command).toMatch(/rm -i/);
    expect(compile(parse(tokenize('copy ~/a ~/b')))[0].command).toMatch(/cp -r/);
    expect(compile(parse(tokenize('read ~/f.txt')))[0].command).toMatch(/cat/);
  });

  test('ping compiles to ping -c 4', () => {
    expect(compile(parse(tokenize('ping google.com')))[0].command).toMatch(/ping -c 4/);
  });

  test('wait → sleep', () => {
    expect(compile(parse(tokenize('wait 3 seconds')))[0].command).toBe('sleep 3');
  });

  test('show disk space → df -h', () => {
    expect(compile(parse(tokenize('show disk space')))[0].command).toBe('df -h');
  });

  test('if exists → test -e', () => {
    const r = compile(parse(tokenize('if file ~/Desktop exists:\n  print "yes"\nend')));
    expect(r[0].command).toMatch(/test -e/);
    expect(r[1].conditional).toBe(true);
  });

  test('path ~ expanded', () => {
    const r = compile(parse(tokenize('read ~/test.txt')));
    expect(r[0].command).not.toMatch(/~\//);
    expect(r[0].command).toContain(require('os').homedir());
  });
});

describe('explain', () => {
  test('returns steps with nova, command, type', () => {
    const r = explain('print "test"');
    expect(r[0]).toHaveProperty('nova');
    expect(r[0]).toHaveProperty('command');
    expect(r[0]).toHaveProperty('type');
  });

  test('resolves variables', () => {
    const r = explain('set x to "world"\nprint x');
    expect(r[1].command).toContain('world');
  });
});

describe('EXAMPLES', () => {
  test('non-empty array with required fields', () => {
    expect(EXAMPLES.length).toBeGreaterThan(0);
    for (const ex of EXAMPLES) {
      expect(ex.name).toBeTruthy();
      expect(ex.code).toBeTruthy();
    }
  });

  test('all examples tokenize and parse', () => {
    for (const ex of EXAMPLES) {
      const tokens = tokenize(ex.code);
      const ast = parse(tokens);
      expect(ast.length).toBeGreaterThan(0);
    }
  });
});

describe('Edge cases', () => {
  test('empty source → empty AST', () => {
    expect(parse(tokenize(''))).toHaveLength(0);
  });

  test('unknown commands produce unknown nodes', () => {
    const ast = parse(tokenize('xyzzy something'));
    expect(ast[0].type).toBe('unknown');
    const r = compile(ast);
    expect(r[0].command).toMatch(/# Unknown:/);
  });

  test('blank lines between statements skipped', () => {
    expect(parse(tokenize('print "a"\n\n\nprint "b"'))).toHaveLength(2);
  });

  test('system toggles', () => {
    expect(parse(tokenize('turn on dark mode'))[0].enabled).toBe(true);
    expect(parse(tokenize('turn off wifi'))[0].enabled).toBe(false);
  });

  test('utility commands', () => {
    expect(parse(tokenize('empty trash'))[0].subtype).toBe('empty_trash');
    expect(parse(tokenize('force quit chrome'))[0].subtype).toBe('force_quit');
  });
});
