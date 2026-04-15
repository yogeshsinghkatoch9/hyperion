/**
 * Hyperion Snippet Manager — Save, search, tag, organize code snippets
 */
const { v4: uuidv4 } = require('uuid');

// ═══ SUPPORTED LANGUAGES ═══

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'go', 'rust', 'java', 'c', 'cpp',
  'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'bash', 'shell',
  'sql', 'html', 'css', 'json', 'yaml', 'toml', 'xml', 'markdown',
  'dockerfile', 'terraform', 'graphql', 'lua', 'r', 'dart', 'elixir', 'text',
];

function isValidLanguage(lang) {
  return LANGUAGES.includes(lang?.toLowerCase());
}

function normalizeLanguage(lang) {
  if (!lang) return 'text';
  const lower = lang.toLowerCase();
  const aliases = {
    js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
    sh: 'bash', zsh: 'bash', yml: 'yaml', md: 'markdown',
    'c++': 'cpp', 'c#': 'csharp', rs: 'rust', tf: 'terraform',
    gql: 'graphql', kt: 'kotlin',
  };
  return aliases[lower] || (LANGUAGES.includes(lower) ? lower : 'text');
}

// ═══ SNIPPET CRUD ═══

function createSnippet(db, { name, code, language, tags, description, favorite }) {
  if (!name || !name.trim()) throw new Error('Name required');
  if (!code && code !== '') throw new Error('Code required');

  const id = uuidv4();
  const lang = normalizeLanguage(language);
  const tagList = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);

  db.prepare(`INSERT INTO snippets (id, name, language, code, tags) VALUES (?, ?, ?, ?, ?)`)
    .run(id, name.trim(), lang, code, JSON.stringify(tagList));

  return { id, name: name.trim(), language: lang, code, tags: tagList };
}

function getSnippet(db, id) {
  const s = db.prepare('SELECT * FROM snippets WHERE id = ?').get(id);
  if (!s) throw new Error('Snippet not found');
  s.tags = JSON.parse(s.tags || '[]');
  return s;
}

function updateSnippet(db, id, fields) {
  const existing = getSnippet(db, id);
  const updates = {};

  if (fields.name !== undefined) updates.name = fields.name.trim();
  if (fields.code !== undefined) updates.code = fields.code;
  if (fields.language !== undefined) updates.language = normalizeLanguage(fields.language);
  if (fields.tags !== undefined) {
    const tagList = Array.isArray(fields.tags) ? fields.tags : fields.tags.split(',').map(t => t.trim()).filter(Boolean);
    updates.tags = JSON.stringify(tagList);
  }

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  if (!sets) return existing;

  db.prepare(`UPDATE snippets SET ${sets} WHERE id = ?`).run(...Object.values(updates), id);
  return { ...existing, ...updates, tags: updates.tags ? JSON.parse(updates.tags) : existing.tags };
}

function deleteSnippet(db, id) {
  const result = db.prepare('DELETE FROM snippets WHERE id = ?').run(id);
  if (result.changes === 0) throw new Error('Snippet not found');
  return { deleted: true };
}

function listSnippets(db, { language, tag, search, limit = 100, offset = 0 } = {}) {
  let query = 'SELECT * FROM snippets WHERE 1=1';
  const params = [];

  if (language) {
    query += ' AND language = ?';
    params.push(normalizeLanguage(language));
  }
  if (tag) {
    query += ' AND tags LIKE ?';
    params.push(`%"${tag}"%`);
  }
  if (search) {
    query += ' AND (name LIKE ? OR code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  return db.prepare(query).all(...params).map(s => ({
    ...s,
    tags: JSON.parse(s.tags || '[]'),
  }));
}

// ═══ TAG OPERATIONS ═══

function getAllTags(db) {
  const snippets = db.prepare('SELECT tags FROM snippets').all();
  const tagCounts = {};
  snippets.forEach(s => {
    const tags = JSON.parse(s.tags || '[]');
    tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });
  return Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// ═══ IMPORT / EXPORT ═══

function exportSnippets(db, format = 'json') {
  const snippets = listSnippets(db, { limit: 10000 });
  if (format === 'json') {
    return JSON.stringify(snippets, null, 2);
  }
  // CSV
  const header = 'name,language,tags,code';
  const rows = snippets.map(s =>
    `"${s.name.replace(/"/g, '""')}","${s.language}","${s.tags.join(';')}","${s.code.replace(/"/g, '""')}"`
  );
  return [header, ...rows].join('\n');
}

function importSnippets(db, data) {
  let snippets;
  if (typeof data === 'string') {
    snippets = JSON.parse(data);
  } else {
    snippets = data;
  }
  if (!Array.isArray(snippets)) throw new Error('Expected array of snippets');

  let imported = 0;
  for (const s of snippets) {
    if (s.name && s.code !== undefined) {
      createSnippet(db, s);
      imported++;
    }
  }
  return { imported, total: snippets.length };
}

// ═══ STATS ═══

function getStats(db) {
  const total = db.prepare('SELECT COUNT(*) as count FROM snippets').get().count;
  const byLang = db.prepare('SELECT language, COUNT(*) as count FROM snippets GROUP BY language ORDER BY count DESC').all();
  const tags = getAllTags(db);
  return { total, byLanguage: byLang, topTags: tags.slice(0, 10) };
}

module.exports = {
  LANGUAGES, isValidLanguage, normalizeLanguage,
  createSnippet, getSnippet, updateSnippet, deleteSnippet, listSnippets,
  getAllTags, exportSnippets, importSnippets, getStats,
};
