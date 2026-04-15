/**
 * Vector Memory — Conversational memory with embeddings
 * Primary: LLM provider embeddings (OpenAI/Ollama/Gemini)
 * Fallback: TF-IDF with cosine similarity (no external deps)
 * Storage: SQLite with embedding BLOBs
 */

const { v4: uuidv4 } = require('uuid');

let _db = null;

// ── TF-IDF Fallback ──
const idfCache = new Map();

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function computeTFIDF(text, corpus) {
  const tokens = tokenize(text);
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const maxTF = Math.max(...tf.values(), 1);

  const vocab = new Set();
  for (const [word] of tf) vocab.add(word);

  const vector = {};
  for (const word of vocab) {
    const termFreq = (tf.get(word) || 0) / maxTF;
    let docFreq = idfCache.get(word);
    if (docFreq === undefined) {
      docFreq = corpus.filter(doc => doc.includes(word)).length;
      idfCache.set(word, docFreq);
    }
    const idf = Math.log((corpus.length + 1) / (docFreq + 1)) + 1;
    vector[word] = termFreq * idf;
  }
  return vector;
}

function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, magA = 0, magB = 0;
  for (const key of keys) {
    const va = a[key] || 0, vb = b[key] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function cosineSimArrays(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Core Operations ──
function init(db) {
  _db = db;
}

async function store(text, metadata = {}) {
  if (!_db) return null;

  const id = uuidv4();
  const { getEmbedding } = require('./llmService');

  let embeddingBlob = null;
  try {
    const embedding = await getEmbedding(text);
    if (embedding) {
      embeddingBlob = Buffer.from(new Float64Array(embedding).buffer);
    }
  } catch {}

  _db.prepare(
    'INSERT INTO conversations (id, user_id, role, content, embedding, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime(\'now\'))'
  ).run(id, metadata.userId || 'system', metadata.role || 'user', text, embeddingBlob, JSON.stringify(metadata));

  return id;
}

async function search(query, topK = 3) {
  if (!_db) return [];

  const { getEmbedding } = require('./llmService');
  let queryEmbedding = null;

  try {
    queryEmbedding = await getEmbedding(query);
  } catch {}

  const rows = _db.prepare(
    'SELECT id, role, content, embedding, metadata, created_at FROM conversations ORDER BY created_at DESC LIMIT 200'
  ).all();

  if (!rows.length) return [];

  // If we have embeddings, use vector similarity
  if (queryEmbedding) {
    const scored = rows
      .filter(r => r.embedding)
      .map(r => {
        const emb = new Float64Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 8);
        const sim = cosineSimArrays(queryEmbedding, Array.from(emb));
        return { ...r, similarity: sim, embedding: undefined, metadata: JSON.parse(r.metadata || '{}') };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    if (scored.length) return scored;
  }

  // TF-IDF fallback
  const corpus = rows.map(r => r.content.toLowerCase());
  const queryVec = computeTFIDF(query, corpus);

  return rows
    .map(r => {
      const docVec = computeTFIDF(r.content, corpus);
      const sim = cosineSimilarity(queryVec, docVec);
      return { ...r, similarity: sim, embedding: undefined, metadata: JSON.parse(r.metadata || '{}') };
    })
    .filter(r => r.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

function getRecent(limit = 20) {
  if (!_db) return [];
  return _db.prepare(
    'SELECT id, role, content, metadata, created_at FROM conversations ORDER BY created_at DESC LIMIT ?'
  ).all(limit).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
}

function forget(id) {
  if (!_db) return false;
  const result = _db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  return result.changes > 0;
}

function getStats() {
  if (!_db) return { total: 0, withEmbeddings: 0, oldestDate: null, newestDate: null };
  const total = _db.prepare('SELECT COUNT(*) as c FROM conversations').get().c;
  const withEmb = _db.prepare('SELECT COUNT(*) as c FROM conversations WHERE embedding IS NOT NULL').get().c;
  const oldest = _db.prepare('SELECT MIN(created_at) as d FROM conversations').get().d;
  const newest = _db.prepare('SELECT MAX(created_at) as d FROM conversations').get().d;
  return { total, withEmbeddings: withEmb, oldestDate: oldest, newestDate: newest };
}

function clearAll() {
  if (!_db) return;
  _db.prepare('DELETE FROM conversations').run();
  idfCache.clear();
}

module.exports = { init, store, search, getRecent, forget, getStats, clearAll };
