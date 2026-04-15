/**
 * Skill Loader
 * Scans ~/.hyperion/skills/ for SKILL.md files with frontmatter triggers.
 * Skills inject context into the LLM prompt when trigger patterns match.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SKILLS_DIR = path.join(os.homedir(), '.hyperion', 'skills');
let loadedSkills = [];

function ensureSkillsDir() {
  try { fs.mkdirSync(SKILLS_DIR, { recursive: true }); } catch {}
}

function parseFrontmatter(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) {
      let val = kv[2].trim();
      // Parse arrays: ["a", "b", "c"]
      if (val.startsWith('[') && val.endsWith(']')) {
        try { val = JSON.parse(val); } catch {
          val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
        }
      }
      meta[kv[1]] = val;
    }
  }
  return { meta, body: match[2].trim() };
}

function loadSkills() {
  ensureSkillsDir();
  loadedSkills = [];

  let entries;
  try {
    entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  } catch {
    return loadedSkills;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(SKILLS_DIR, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');

    try {
      if (!fs.existsSync(skillFile)) continue;
      const raw = fs.readFileSync(skillFile, 'utf8');
      const { meta, body } = parseFrontmatter(raw);

      const triggers = Array.isArray(meta.triggers) ? meta.triggers : (meta.triggers ? [meta.triggers] : []);

      loadedSkills.push({
        id: entry.name,
        name: meta.name || entry.name,
        description: meta.description || '',
        triggers: triggers.map(t => t.toLowerCase()),
        instructions: body,
        path: skillFile,
      });

      console.log(`  Skill loaded: ${meta.name || entry.name} (${triggers.length} triggers)`);
    } catch (err) {
      console.error(`  Skill error (${entry.name}): ${err.message}`);
    }
  }

  return loadedSkills;
}

function matchSkill(input) {
  const lower = input.toLowerCase();
  for (const skill of loadedSkills) {
    for (const trigger of skill.triggers) {
      if (lower.includes(trigger)) return skill;
    }
  }
  return null;
}

function getSkills() {
  return loadedSkills;
}

function getSkill(id) {
  return loadedSkills.find(s => s.id === id) || null;
}

function saveSkill(id, content) {
  const skillDir = path.join(SKILLS_DIR, id);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  loadSkills(); // reload
}

function deleteSkill(id) {
  const skillDir = path.join(SKILLS_DIR, id);
  try { fs.rmSync(skillDir, { recursive: true }); } catch {}
  loadedSkills = loadedSkills.filter(s => s.id !== id);
}

module.exports = { loadSkills, matchSkill, getSkills, getSkill, saveSkill, deleteSkill, SKILLS_DIR };
