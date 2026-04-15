/**
 * Plugin Management Routes
 */

const express = require('express');
const router = express.Router();
const pluginLoader = require('../services/pluginLoader');
const skillLoader = require('../services/skillLoader');

// List loaded plugins + skills
router.get('/', (req, res) => {
  const plugins = pluginLoader.getPlugins();
  const skills = skillLoader.getSkills();
  res.json({
    plugins: plugins.map(p => ({
      id: p.id,
      name: p.name,
      version: p.version,
      description: p.description,
      author: p.author,
      patterns: p.patterns.length,
      quickActions: p.quickActions.length,
      novaKeywords: p.novaKeywords.length,
    })),
    skills: skills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      triggers: s.triggers,
    })),
  });
});

// Hot-reload all plugins
router.post('/reload', (req, res) => {
  const plugins = pluginLoader.reloadPlugins();
  res.json({ ok: true, loaded: plugins.length, plugins: plugins.map(p => p.name) });
});

// GET /api/plugins/:id/readme — get plugin readme
router.get('/:id/readme', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const pluginDir = path.join(require('os').homedir(), '.hyperion', 'plugins', req.params.id);
  const readmePath = path.join(pluginDir, 'README.md');
  try {
    if (fs.existsSync(readmePath)) {
      res.json({ readme: fs.readFileSync(readmePath, 'utf8') });
    } else {
      res.json({ readme: 'No README found.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/plugins/create — generate boilerplate plugin
router.post('/create', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const { name, description, capabilities } = req.body;
  if (!name) return res.status(400).json({ error: 'Plugin name required' });

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
  const pluginDir = path.join(require('os').homedir(), '.hyperion', 'plugins', id);

  try {
    fs.mkdirSync(pluginDir, { recursive: true });

    // plugin.json
    const manifest = {
      id, name, version: '1.0.0',
      description: description || `${name} plugin`,
      author: 'Hyperion User',
      patterns: capabilities?.includes('patterns') ? [{ pattern: 'example (.*)', command: 'echo "Matched: $1"', description: 'Example pattern' }] : [],
      quickActions: capabilities?.includes('actions') ? [{ label: `Run ${name}`, query: `run ${id}`, category: name }] : [],
      novaKeywords: capabilities?.includes('nova') ? [{ keyword: id, command: `echo "${name} executed"`, description: `${name} NOVA command` }] : [],
    };
    fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify(manifest, null, 2));

    // index.js
    const indexContent = `// ${name} Plugin for Hyperion
module.exports = {
  init() {
    console.log('${name} plugin initialized');
  },
  cleanup() {
    console.log('${name} plugin cleaned up');
  },
};
`;
    fs.writeFileSync(path.join(pluginDir, 'index.js'), indexContent);

    // README.md
    fs.writeFileSync(path.join(pluginDir, 'README.md'), `# ${name}\n\n${description || 'A Hyperion plugin.'}\n`);

    res.json({ ok: true, id, path: pluginDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/plugins/:id — remove plugin directory
router.delete('/:id', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const pluginDir = path.join(require('os').homedir(), '.hyperion', 'plugins', req.params.id);
  try {
    fs.rmSync(pluginDir, { recursive: true, force: true });
    pluginLoader.reloadPlugins();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Skill CRUD ──
// Create/update skill
router.post('/skill', (req, res) => {
  const { id, content } = req.body;
  if (!id || !content) return res.status(400).json({ error: 'id and content required' });
  try {
    skillLoader.saveSkill(id, content);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete skill
router.delete('/skill/:id', (req, res) => {
  try {
    skillLoader.deleteSkill(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reload skills
router.post('/skills/reload', (req, res) => {
  const skills = skillLoader.loadSkills();
  res.json({ ok: true, loaded: skills.length });
});

module.exports = router;
