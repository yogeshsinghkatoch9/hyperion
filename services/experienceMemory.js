/**
 * Experience Memory — Persistent learning from task execution
 * Stores structured records of every task step.
 * On new tasks, retrieves similar past experiences to inject as context.
 * Reuses vectorMemory.js pattern: llmService.getEmbedding() + cosine similarity + TF-IDF fallback.
 */

const { v4: uuidv4 } = require('uuid');

// ── TF-IDF Fallback (same as vectorMemory.js) ──
const idfCache = new Map();

function _tokenize(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function _computeTFIDF(text, corpus) {
  const tokens = _tokenize(text);
  const tf = new Map();
  for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
  const maxTF = Math.max(...tf.values(), 1);

  const vector = {};
  for (const [word] of tf) {
    const termFreq = tf.get(word) / maxTF;
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

function _cosineSim(a, b) {
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

function _cosineSimArrays(a, b) {
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

/**
 * Store an experience record after a task step completes.
 * @param {object} db - SQLite database instance
 * @param {object} exp - Experience data
 */
async function storeExperience(db, {
  taskSessionId,
  stepIndex,
  goalSummary,
  toolSequence = [],
  outcome,           // 'success' | 'failure' | 'partial'
  reflectionNotes,
  errorType,
  recoveryAction,
  confidence = 0.5,
}) {
  if (!db || !goalSummary) return null;

  const id = uuidv4();
  let embeddingBlob = null;

  // Try to get embedding for similarity search
  try {
    const { getEmbedding } = require('./llmService');
    const embedding = await getEmbedding(goalSummary);
    if (embedding) {
      embeddingBlob = Buffer.from(new Float64Array(embedding).buffer);
    }
  } catch {}

  try {
    db.prepare(`INSERT INTO agent_experiences
      (id, task_session_id, step_index, goal_summary, tool_sequence, outcome, reflection_notes, error_type, recovery_action, embedding, confidence, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`)
    .run(
      id,
      taskSessionId || null,
      stepIndex ?? null,
      goalSummary,
      JSON.stringify(toolSequence),
      outcome || 'unknown',
      reflectionNotes || null,
      errorType || null,
      recoveryAction || null,
      embeddingBlob,
      confidence,
    );
    return id;
  } catch (err) {
    console.error('[ExperienceMemory] Store failed:', err.message);
    return null;
  }
}

/**
 * Search for similar past experiences.
 * @param {object} db - SQLite database instance
 * @param {string} goalQuery - The current goal/step to find similar experiences for
 * @param {number} topK - Number of results (default: 3)
 * @returns {Array<{ goalSummary, outcome, reflectionNotes, toolSequence, similarity }>}
 */
async function searchExperiences(db, goalQuery, topK = 3) {
  if (!db || !goalQuery) return [];

  let rows;
  try {
    rows = db.prepare(
      'SELECT id, goal_summary, tool_sequence, outcome, reflection_notes, error_type, recovery_action, embedding, confidence FROM agent_experiences ORDER BY created_at DESC LIMIT 200'
    ).all();
  } catch {
    return [];
  }

  if (!rows.length) return [];

  // Try embedding-based search first
  let queryEmbedding = null;
  try {
    const { getEmbedding } = require('./llmService');
    queryEmbedding = await getEmbedding(goalQuery);
  } catch {}

  if (queryEmbedding) {
    const scored = rows
      .filter(r => r.embedding)
      .map(r => {
        const emb = new Float64Array(r.embedding.buffer, r.embedding.byteOffset, r.embedding.byteLength / 8);
        const sim = _cosineSimArrays(queryEmbedding, Array.from(emb));
        return _formatResult(r, sim);
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    if (scored.length) return scored;
  }

  // TF-IDF fallback
  const corpus = rows.map(r => r.goal_summary.toLowerCase());
  const queryVec = _computeTFIDF(goalQuery, corpus);

  return rows
    .map(r => {
      const docVec = _computeTFIDF(r.goal_summary, corpus);
      const sim = _cosineSim(queryVec, docVec);
      return _formatResult(r, sim);
    })
    .filter(r => r.similarity > 0.05)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Format a search result for injection into prompts.
 */
function _formatResult(row, similarity) {
  return {
    goalSummary: row.goal_summary,
    outcome: row.outcome,
    reflectionNotes: row.reflection_notes,
    toolSequence: _safeParse(row.tool_sequence, []),
    errorType: row.error_type,
    recoveryAction: row.recovery_action,
    confidence: row.confidence,
    similarity,
  };
}

/**
 * Format experiences as prompt context.
 * @param {Array} experiences - Results from searchExperiences
 * @returns {string} - Formatted text for system prompt injection
 */
function formatAsContext(experiences) {
  if (!experiences || experiences.length === 0) return '';

  const lines = experiences.map((exp, i) => {
    const tools = exp.toolSequence?.join(' → ') || 'unknown';
    const notes = exp.reflectionNotes ? ` — ${exp.reflectionNotes}` : '';
    const recovery = exp.recoveryAction ? ` Recovery: ${exp.recoveryAction}` : '';
    return `${i + 1}. [${exp.outcome}] "${exp.goalSummary}" — tools: ${tools}${notes}${recovery}`;
  });

  return `PAST EXPERIENCE (similar tasks):\n${lines.join('\n')}`;
}

/**
 * Get aggregate stats for the experience memory.
 */
function getStats(db) {
  if (!db) return { total: 0, successRate: 0, topErrorTypes: [] };

  try {
    const total = db.prepare('SELECT COUNT(*) as c FROM agent_experiences').get().c;
    const successes = db.prepare("SELECT COUNT(*) as c FROM agent_experiences WHERE outcome = 'success'").get().c;
    const errors = db.prepare(
      "SELECT error_type, COUNT(*) as c FROM agent_experiences WHERE error_type IS NOT NULL GROUP BY error_type ORDER BY c DESC LIMIT 5"
    ).all();

    return {
      total,
      successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
      topErrorTypes: errors.map(e => ({ type: e.error_type, count: e.c })),
    };
  } catch {
    return { total: 0, successRate: 0, topErrorTypes: [] };
  }
}

function _safeParse(json, fallback) {
  try { return JSON.parse(json); } catch { return fallback; }
}

module.exports = { storeExperience, searchExperiences, formatAsContext, getStats };
