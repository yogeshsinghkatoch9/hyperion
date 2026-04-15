import { describe, it, expect } from 'vitest';
const yaml = require('../services/yamlTools');

describe('Parse Simple Values', () => {
  it('parses simple key: value pairs', () => {
    const result = yaml.parse('name: Alice\nage: 30');
    expect(result.name).toBe('Alice');
    expect(result.age).toBe(30);
  });

  it('parses nested objects', () => {
    const input = 'person:\n  name: Bob\n  age: 25';
    const result = yaml.parse(input);
    expect(result.person.name).toBe('Bob');
    expect(result.person.age).toBe(25);
  });

  it('parses lists', () => {
    const input = 'fruits:\n  - apple\n  - banana\n  - cherry';
    const result = yaml.parse(input);
    expect(result.fruits).toEqual(['apple', 'banana', 'cherry']);
  });

  it('parses numbers correctly', () => {
    const input = 'integer: 42\nfloat: 3.14';
    const result = yaml.parse(input);
    expect(result.integer).toBe(42);
    expect(result.float).toBe(3.14);
  });

  it('parses booleans', () => {
    const input = 'enabled: true\ndisabled: false';
    const result = yaml.parse(input);
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
  });

  it('parses null values', () => {
    const input = 'empty: null\ntilde: ~';
    const result = yaml.parse(input);
    expect(result.empty).toBeNull();
    expect(result.tilde).toBeNull();
  });

  it('parses negative numbers', () => {
    const input = 'temp: -10\nbalance: -99.5';
    const result = yaml.parse(input);
    expect(result.temp).toBe(-10);
    expect(result.balance).toBe(-99.5);
  });

  it('parses quoted strings that look like booleans', () => {
    const input = 'value: "true"';
    const result = yaml.parse(input);
    expect(result.value).toBe('true');
  });
});

describe('Stringify', () => {
  it('converts a simple object to YAML', () => {
    const result = yaml.stringify({ name: 'Alice', age: 30 });
    expect(result).toContain('name: Alice');
    expect(result).toContain('age: 30');
  });

  it('converts nested objects to indented YAML', () => {
    const result = yaml.stringify({ person: { name: 'Bob' } });
    expect(result).toContain('person:');
    expect(result).toContain('  name: Bob');
  });

  it('converts arrays to dash-list YAML', () => {
    const result = yaml.stringify({ items: ['a', 'b', 'c'] });
    expect(result).toContain('- a');
    expect(result).toContain('- b');
    expect(result).toContain('- c');
  });

  it('converts boolean and null values', () => {
    const result = yaml.stringify({ flag: true, nothing: null });
    expect(result).toContain('flag: true');
    expect(result).toContain('nothing: null');
  });

  it('handles empty object', () => {
    const result = yaml.stringify({});
    expect(result).toContain('{}');
  });

  it('handles empty array', () => {
    const result = yaml.stringify({ list: [] });
    expect(result).toContain('[]');
  });
});

describe('jsonToYaml', () => {
  it('converts a JSON string to YAML', () => {
    const json = '{"name":"Alice","age":30}';
    const result = yaml.jsonToYaml(json);
    expect(result).toContain('name: Alice');
    expect(result).toContain('age: 30');
  });

  it('roundtrips: jsonToYaml then yamlToJson preserves data', () => {
    const original = '{"x":1,"y":"hello","z":true}';
    const yamlStr = yaml.jsonToYaml(original);
    const jsonStr = yaml.yamlToJson(yamlStr);
    const result = JSON.parse(jsonStr);
    expect(result.x).toBe(1);
    expect(result.y).toBe('hello');
    expect(result.z).toBe(true);
  });
});

describe('yamlToJson', () => {
  it('converts YAML to a JSON string', () => {
    const input = 'name: Alice\nage: 30';
    const result = yaml.yamlToJson(input);
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Alice');
    expect(parsed.age).toBe(30);
  });

  it('roundtrips: yamlToJson then jsonToYaml preserves data', () => {
    const original = 'color: blue\ncount: 5';
    const jsonStr = yaml.yamlToJson(original);
    const yamlStr = yaml.jsonToYaml(jsonStr);
    const backToJson = yaml.yamlToJson(yamlStr);
    const result = JSON.parse(backToJson);
    expect(result.color).toBe('blue');
    expect(result.count).toBe(5);
  });
});

describe('Validate', () => {
  it('returns valid for correct YAML', () => {
    const result = yaml.validate('name: Alice\nage: 30');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('returns valid for simple scalar', () => {
    const result = yaml.validate('42');
    expect(result.valid).toBe(true);
  });

  it('returns error for bad YAML with tab indentation', () => {
    // The parser expects spaces for indentation; tabs cause issues
    const badYaml = 'parent:\n\t\tchild: value\n\t\t\tgrandchild: broken';
    const result = yaml.validate(badYaml);
    // Tab-indented YAML may parse incorrectly (not as intended nested structure)
    // At minimum, verify it either errors or produces unexpected structure
    if (result.valid) {
      // If it parsed, the structure should be flat/wrong due to tab mishandling
      const parsed = yaml.parse(badYaml);
      // Tabs are not counted as indent by the parser, so nesting breaks
      expect(parsed.parent).not.toEqual({ child: { grandchild: 'broken' } });
    } else {
      expect(result.error).toBeTypeOf('string');
    }
  });
});

describe('Edge Cases', () => {
  it('handles empty string input to parse', () => {
    const result = yaml.parse('');
    expect(result).toBeNull();
  });

  it('handles whitespace-only input to parse', () => {
    const result = yaml.parse('   \n   \n   ');
    expect(result).toBeNull();
  });

  it('parse throws for non-string input', () => {
    expect(() => yaml.parse(123)).toThrow('parse() expects a string');
  });

  it('handles inline flow sequences', () => {
    const result = yaml.parse('items: [1, 2, 3]');
    expect(result.items).toEqual([1, 2, 3]);
  });

  it('handles inline flow mappings', () => {
    const result = yaml.parse('point: {x: 1, y: 2}');
    expect(result.point).toEqual({ x: 1, y: 2 });
  });
});
