/**
 * Skills System Tests — SKILL.md parsing, trigger matching
 */
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILLS_DIR = path.join(os.homedir(), '.hyperion', 'skills');
const TEST_SKILL_DIR = path.join(SKILLS_DIR, 'test-skill');
const TEST_SKILL_FILE = path.join(TEST_SKILL_DIR, 'SKILL.md');

describe('Skill Loader', () => {
  let skillLoader;

  beforeAll(() => {
    // Create test skill
    fs.mkdirSync(TEST_SKILL_DIR, { recursive: true });
    fs.writeFileSync(TEST_SKILL_FILE, `---
name: test-skill
triggers: ["test", "testing", "check"]
description: A test skill
---
When the user asks about testing:
1. Run the test suite
2. Report results
`);
    skillLoader = require('../services/skillLoader');
    skillLoader.loadSkills();
  });

  afterAll(() => {
    try { fs.rmSync(TEST_SKILL_DIR, { recursive: true }); } catch {}
  });

  test('loadSkills loads SKILL.md files', () => {
    const skills = skillLoader.getSkills();
    expect(skills.length).toBeGreaterThanOrEqual(1);
    const testSkill = skills.find(s => s.id === 'test-skill');
    expect(testSkill).toBeTruthy();
    expect(testSkill.name).toBe('test-skill');
    expect(testSkill.triggers).toContain('test');
    expect(testSkill.triggers).toContain('testing');
    expect(testSkill.triggers).toContain('check');
  });

  test('matchSkill returns skill when trigger matches', () => {
    const skill = skillLoader.matchSkill('how do I run a test');
    expect(skill).toBeTruthy();
    expect(skill.name).toBe('test-skill');
  });

  test('matchSkill returns null when no trigger matches', () => {
    const skill = skillLoader.matchSkill('unrelated query about weather');
    expect(skill).toBeNull();
  });

  test('getSkill returns specific skill by id', () => {
    const skill = skillLoader.getSkill('test-skill');
    expect(skill).toBeTruthy();
    expect(skill.description).toBe('A test skill');
  });

  test('getSkill returns null for nonexistent id', () => {
    expect(skillLoader.getSkill('nonexistent')).toBeNull();
  });

  test('skill instructions contain body text', () => {
    const skill = skillLoader.getSkill('test-skill');
    expect(skill.instructions).toContain('Run the test suite');
    expect(skill.instructions).toContain('Report results');
  });
});
