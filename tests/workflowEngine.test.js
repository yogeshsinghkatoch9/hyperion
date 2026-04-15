import { describe, test, expect, vi } from 'vitest';

const engine = await import('../services/workflowEngine.js');

// ── evaluateCondition ──
describe('evaluateCondition', () => {
  test('eq matches', () => {
    expect(engine.evaluateCondition('0', 'eq', '0')).toBe(true);
    expect(engine.evaluateCondition('hello', 'eq', 'hello')).toBe(true);
    expect(engine.evaluateCondition('a', 'eq', 'b')).toBe(false);
  });

  test('neq matches', () => {
    expect(engine.evaluateCondition('a', 'neq', 'b')).toBe(true);
    expect(engine.evaluateCondition('x', 'neq', 'x')).toBe(false);
  });

  test('gt comparison', () => {
    expect(engine.evaluateCondition('10', 'gt', '5')).toBe(true);
    expect(engine.evaluateCondition('3', 'gt', '5')).toBe(false);
    expect(engine.evaluateCondition('5', 'gt', '5')).toBe(false);
  });

  test('lt comparison', () => {
    expect(engine.evaluateCondition('3', 'lt', '5')).toBe(true);
    expect(engine.evaluateCondition('10', 'lt', '5')).toBe(false);
  });

  test('contains', () => {
    expect(engine.evaluateCondition('hello world', 'contains', 'world')).toBe(true);
    expect(engine.evaluateCondition('hello', 'contains', 'xyz')).toBe(false);
  });

  test('matches (regex)', () => {
    expect(engine.evaluateCondition('hello123', 'matches', '\\d+')).toBe(true);
    expect(engine.evaluateCondition('abc', 'matches', '^abc$')).toBe(true);
    expect(engine.evaluateCondition('def', 'matches', '^abc$')).toBe(false);
  });

  test('matches handles invalid regex', () => {
    expect(engine.evaluateCondition('test', 'matches', '[invalid')).toBe(false);
  });

  test('unknown operator returns false', () => {
    expect(engine.evaluateCondition('a', 'banana', 'b')).toBe(false);
  });

  test('handles null/undefined values', () => {
    expect(engine.evaluateCondition(null, 'eq', '')).toBe(true);
    expect(engine.evaluateCondition(undefined, 'eq', '')).toBe(true);
  });
});

// ── substituteVars ──
describe('substituteVars', () => {
  test('replaces variables', () => {
    expect(engine.substituteVars('hello {{name}}', { name: 'world' })).toBe('hello world');
  });

  test('replaces multiple vars', () => {
    expect(engine.substituteVars('{{a}} + {{b}}', { a: '1', b: '2' })).toBe('1 + 2');
  });

  test('missing var replaced with empty string', () => {
    expect(engine.substituteVars('{{missing}}', {})).toBe('');
  });

  test('non-string passthrough', () => {
    expect(engine.substituteVars(42, {})).toBe(42);
    expect(engine.substituteVars(null, {})).toBe(null);
  });

  test('no templates pass through', () => {
    expect(engine.substituteVars('plain text', {})).toBe('plain text');
  });
});

// ── MAX_LOOP_ITERATIONS ──
describe('MAX_LOOP_ITERATIONS', () => {
  test('is 100', () => {
    expect(engine.MAX_LOOP_ITERATIONS).toBe(100);
  });
});

// ── execute: basic actions ──
describe('execute', () => {
  test('empty actions returns empty results', () => {
    const { results } = engine.execute([]);
    expect(results).toEqual([]);
  });

  test('set_variable action', () => {
    const { results, variables } = engine.execute([
      { type: 'set_variable', name: 'MY_VAR', value: 'hello' },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('ok');
    expect(variables.MY_VAR).toBe('hello');
  });

  test('set_variable with substitution', () => {
    const { variables } = engine.execute([
      { type: 'set_variable', name: 'A', value: 'foo' },
      { type: 'set_variable', name: 'B', value: '{{A}}_bar' },
    ]);
    expect(variables.B).toBe('foo_bar');
  });

  test('condition: then branch', () => {
    const { results } = engine.execute([
      { type: 'set_variable', name: 'x', value: '0' },
      { type: 'condition', field: 'x', operator: 'eq', value: '0',
        then: [{ type: 'set_variable', name: 'branch', value: 'then' }],
        else: [{ type: 'set_variable', name: 'branch', value: 'else' }] },
    ]);
    expect(results.find(r => r.output === 'branch=then')).toBeTruthy();
  });

  test('condition: else branch', () => {
    const { results, variables } = engine.execute([
      { type: 'set_variable', name: 'x', value: '1' },
      { type: 'condition', field: 'x', operator: 'eq', value: '0',
        then: [{ type: 'set_variable', name: 'branch', value: 'then' }],
        else: [{ type: 'set_variable', name: 'branch', value: 'else' }] },
    ]);
    expect(variables.branch).toBe('else');
  });

  test('loop executes N times', () => {
    const { results } = engine.execute([
      { type: 'loop', count: 3, variable: 'i', actions: [
        { type: 'set_variable', name: 'counter', value: '{{i}}' },
      ] },
    ]);
    // 3 iterations × 1 set_variable each
    expect(results.filter(r => r.action === 'set_variable')).toHaveLength(3);
  });

  test('loop caps at MAX_LOOP_ITERATIONS', () => {
    const { results } = engine.execute([
      { type: 'loop', count: 999, variable: 'i', actions: [
        { type: 'set_variable', name: 'x', value: 'y' },
      ] },
    ]);
    expect(results).toHaveLength(100);
  });

  test('context variables are available', () => {
    const { variables } = engine.execute([
      { type: 'set_variable', name: 'result', value: '{{input}}' },
    ], { input: 'from_context' });
    expect(variables.result).toBe('from_context');
  });

  test('nested condition inside loop', () => {
    const { results } = engine.execute([
      { type: 'loop', count: 2, variable: 'i', actions: [
        { type: 'condition', field: 'i', operator: 'eq', value: '0',
          then: [{ type: 'set_variable', name: 'match', value: 'yes' }],
          else: [{ type: 'set_variable', name: 'match', value: 'no' }] },
      ] },
    ]);
    const setVars = results.filter(r => r.action === 'set_variable');
    expect(setVars).toHaveLength(2);
  });
});
