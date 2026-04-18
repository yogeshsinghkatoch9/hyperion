/**
 * Task Engine — Autonomous multi-step execution with plan generation
 * Tiers 2-4: Cognitive Core, Learning Engine, Self-Improvement
 * Reuses agentLoop.js executors, approval rules, and security checks.
 * Reuses llmService.js for LLM calls with streaming and tool formatting.
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const llm = require('./llmService');
const agent = require('./agentLoop');
const evaluator = require('./toolResultEvaluator');
const reflection = require('./reflectionEngine');
const experience = require('./experienceMemory');
const strategyLib = require('./strategyLibrary');
const { BENCHMARK_TOOLS, benchmarkExecutors, BENCHMARK_APPROVAL_RULES } = require('./benchmarkTools');
const usageTracker = require('./usageTracker');

const HOME = os.homedir();
const MAX_TOTAL_ITERATIONS = parseInt(process.env.TASK_MAX_TOTAL_ITERATIONS, 10) || 60;
const MAX_STEP_ITERATIONS = parseInt(process.env.TASK_MAX_STEP_ITERATIONS, 10) || 15;
const MAX_REPLANS = 2;
const TOOL_TIMEOUT = 30000;

// ── Extended Tools (3 additions beyond agentLoop's 10) ──
const EXTENDED_TOOLS = [
  {
    name: 'create_document',
    description: 'Create a document file (markdown, text, HTML, CSV) from structured data. Wraps write_file with template formatting.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Output file path' },
        format: { type: 'string', enum: ['markdown', 'text', 'html', 'csv'], description: 'Document format (default: markdown)' },
        title: { type: 'string', description: 'Document title' },
        content: { type: 'string', description: 'Document body content' },
        sections: {
          type: 'array',
          description: 'Optional sections array [{heading, body}]',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              body: { type: 'string' },
            },
          },
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'scaffold_project',
    description: 'Create a project directory structure from a template spec. Creates directories and writes boilerplate files.',
    parameters: {
      type: 'object',
      properties: {
        root: { type: 'string', description: 'Root directory path for the project' },
        structure: {
          type: 'array',
          description: 'Array of {path, content?} — directories end with /, files have content',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string', description: 'Relative path (dirs end with /)' },
              content: { type: 'string', description: 'File content (omit for directories)' },
            },
            required: ['path'],
          },
        },
      },
      required: ['root', 'structure'],
    },
  },
  {
    name: 'task_progress',
    description: 'Report progress back to the user. No execution — purely for status reporting.',
    parameters: {
      type: 'object',
      properties: {
        step: { type: 'string', description: 'Current step description' },
        percentage: { type: 'number', description: 'Progress percentage (0-100)' },
        notes: { type: 'string', description: 'Additional notes' },
      },
      required: ['step'],
    },
  },
];

// ── Extended Executors ──
const extendedExecutors = {
  async create_document({ path: filePath, format, title, content, sections }) {
    const fmt = format || 'markdown';
    let body = '';

    if (fmt === 'markdown') {
      if (title) body += `# ${title}\n\n`;
      body += content || '';
      if (sections) {
        for (const s of sections) {
          body += `\n\n## ${s.heading}\n\n${s.body}`;
        }
      }
    } else if (fmt === 'html') {
      body = `<!DOCTYPE html>\n<html><head><title>${title || 'Document'}</title></head>\n<body>\n`;
      if (title) body += `<h1>${title}</h1>\n`;
      body += content || '';
      if (sections) {
        for (const s of sections) {
          body += `\n<h2>${s.heading}</h2>\n<p>${s.body}</p>`;
        }
      }
      body += '\n</body></html>';
    } else if (fmt === 'csv') {
      body = content || '';
    } else {
      if (title) body += `${title}\n${'='.repeat(title.length)}\n\n`;
      body += content || '';
      if (sections) {
        for (const s of sections) {
          body += `\n\n${s.heading}\n${'-'.repeat(s.heading.length)}\n${s.body}`;
        }
      }
    }

    return agent.executors.write_file({ path: filePath, content: body });
  },

  async scaffold_project({ root, structure }) {
    const resolvedRoot = agent.resolveSafePath(root);
    if (!agent.isPathSafe(resolvedRoot)) return { error: 'Path outside home directory' };

    const created = { dirs: [], files: [] };
    for (const entry of structure) {
      const fullPath = path.join(resolvedRoot, entry.path);
      if (entry.path.endsWith('/')) {
        fs.mkdirSync(fullPath, { recursive: true });
        created.dirs.push(entry.path);
      } else {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, entry.content || '', 'utf8');
        created.files.push(entry.path);
      }
    }
    return { ok: true, root: resolvedRoot, created };
  },

  async task_progress({ step, percentage, notes }) {
    return { ok: true, step, percentage, notes };
  },
};

// Merge all executors (base + extended + benchmark)
const allExecutors = { ...agent.executors, ...extendedExecutors, ...benchmarkExecutors };

// Merge all tools
function getExtendedTools() {
  return [...agent.TOOLS, ...EXTENDED_TOOLS, ...BENCHMARK_TOOLS];
}

// Extended approval check — includes benchmark tools + auto-approve context
function needsApprovalExtended(toolName, args, context) {
  if (['create_document', 'scaffold_project', 'task_progress'].includes(toolName)) {
    if (toolName === 'task_progress') return false;
    return true;
  }
  // Benchmark tool approval rules
  if (BENCHMARK_APPROVAL_RULES[toolName] !== undefined) {
    const rule = BENCHMARK_APPROVAL_RULES[toolName];
    if (rule === 'always') return true;
    if (rule === 'never') return false;
  }
  return agent.needsApproval(toolName, args, context);
}

// ── Plan Generation ──
const PLAN_SYSTEM_PROMPT = `You are a task planner. Given a user's goal, create a structured execution plan.
Return ONLY a JSON array of steps — no markdown, no explanation, just the raw JSON array:
[
  { "id": 1, "title": "Short step title", "description": "What to do", "tools": ["tool_names_needed"], "critical": true },
  ...
]
Rules:
- Break complex goals into 3-8 concrete steps
- Each step should be independently executable
- Mark steps as critical: true if failure should stop the pipeline
- Available tools: run_command, read_file, write_file, list_directory, search_files, docker_action, git_action, http_request, system_info, process_action, create_document, scaffold_project, task_progress, patch_file, search_and_replace, read_file_range, browser_navigate, browser_click, browser_type, browser_screenshot, browser_extract, run_tests
- Be specific in descriptions — include file paths, commands, etc.
- First step should typically gather information (read/list/search)
- Last step should summarize or verify results`;

async function generatePlan(goal, db) {
  // Tier 4: Inject learned strategies if available
  let strategyContext = '';
  if (db) {
    try {
      const strategies = strategyLib.searchStrategies(db, goal, 3);
      strategyContext = strategyLib.formatAsContext(strategies);
    } catch {}
  }

  const systemContent = strategyContext
    ? `${PLAN_SYSTEM_PROMPT}\n\n${strategyContext}`
    : PLAN_SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemContent },
    { role: 'user', content: goal },
  ];

  const result = await llm.callWithFailover(messages, { max_tokens: 2048, temperature: 0.2 });
  let planText = result.content.trim();

  // Strip markdown code fences if present
  planText = planText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

  try {
    const plan = JSON.parse(planText);
    if (!Array.isArray(plan) || plan.length === 0) throw new Error('Empty plan');
    return plan.map((step, i) => ({
      id: step.id || i + 1,
      title: step.title || `Step ${i + 1}`,
      description: step.description || '',
      tools: step.tools || [],
      critical: step.critical !== false,
    }));
  } catch (parseErr) {
    // Retry with stricter prompt
    const retryMessages = [
      { role: 'system', content: PLAN_SYSTEM_PROMPT + '\n\nIMPORTANT: Return ONLY valid JSON. No text before or after the array.' },
      { role: 'user', content: goal },
    ];
    const retry = await llm.callWithFailover(retryMessages, { max_tokens: 2048, temperature: 0.1 });
    let retryText = retry.content.trim().replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const plan = JSON.parse(retryText);
    if (!Array.isArray(plan) || plan.length === 0) throw new Error('Failed to generate valid plan');
    return plan.map((step, i) => ({
      id: step.id || i + 1,
      title: step.title || `Step ${i + 1}`,
      description: step.description || '',
      tools: step.tools || [],
      critical: step.critical !== false,
    }));
  }
}

// ── Pending Approvals for Task Engine ──
const taskPendingApprovals = new Map();

function getTaskPendingApproval(sessionId) {
  return taskPendingApprovals.get(sessionId);
}

function setTaskPendingApproval(sessionId, data) {
  taskPendingApprovals.set(sessionId, data);
}

function clearTaskPendingApproval(sessionId) {
  taskPendingApprovals.delete(sessionId);
}

// ── Step Execution (agent loop per step) — with reflection + experience ──
async function* executeStep(step, stepIndex, goal, previousResults, sessionId, db, userId) {
  const injected = llm.getInjectedSystemPrompt();

  // ── Retrieve past experience for this step ──
  let experienceContext = '';
  if (db) {
    try {
      const similar = await experience.searchExperiences(db, `${step.title} ${step.description}`, 3);
      experienceContext = experience.formatAsContext(similar);
    } catch {}
  }

  const systemPrompt = `${injected}

You are Hyperion AI executing step ${stepIndex + 1} of an autonomous task plan.

GOAL: ${goal}
STEP: ${step.title} — ${step.description}
${previousResults.length ? `\nPREVIOUS RESULTS:\n${previousResults.map((r, i) => `Step ${i + 1}: ${r.summary || 'completed'}`).join('\n')}` : ''}
${experienceContext ? `\n${experienceContext}` : ''}

Execute this step using the available tools. Be thorough but efficient.
When done, provide a brief summary of what was accomplished.

ENVIRONMENT:
- Platform: ${os.platform()} (${os.arch()})
- Shell: ${os.platform() === 'darwin' ? 'zsh' : 'bash'}
- Home: ${HOME}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Execute: ${step.title}\n\n${step.description}` },
  ];

  const tools = getExtendedTools();
  let iteration = 0;
  let provider = null;
  let summary = '';
  const stepToolResults = []; // Track for step reflection

  while (iteration < MAX_STEP_ITERATIONS) {
    iteration++;
    let fullText = '';
    let toolCalls = [];

    const stream = llm.callWithStreaming(messages, { tools, max_tokens: 4096 });

    for await (const event of stream) {
      if (event.type === 'provider') {
        provider = event.data.provider;
        yield { type: 'provider', data: event.data };
      } else if (event.type === 'text_delta') {
        fullText += event.data;
        yield { type: 'text', data: event.data };
      } else if (event.type === 'tool_call') {
        toolCalls.push(event.data);
      } else if (event.type === 'error') {
        yield { type: 'error', data: event.data };
        return { success: false, summary: event.data, iterations: iteration, toolResults: stepToolResults };
      } else if (event.type === 'done') {
        if (event.data?.toolCalls?.length) toolCalls = event.data.toolCalls;
      }
    }

    // No tool calls — step done
    if (toolCalls.length === 0) {
      summary = fullText;
      if (fullText) messages.push({ role: 'assistant', content: fullText });
      return { success: true, summary, iterations: iteration, provider, toolResults: stepToolResults };
    }

    // Build assistant message
    const assistantContent = [];
    if (fullText) assistantContent.push({ type: 'text', text: fullText });
    for (const tc of toolCalls) {
      assistantContent.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments });
    }
    messages.push({ role: 'assistant', content: assistantContent });

    // Execute tool calls
    const toolResults = [];
    for (const tc of toolCalls) {
      yield { type: 'tool_start', data: { id: tc.id, name: tc.name, arguments: tc.arguments } };

      // Check approval (pass db/userId context for auto-approve learning)
      if (needsApprovalExtended(tc.name, tc.arguments, { db, userId })) {
        yield { type: 'approval_needed', data: { id: tc.id, name: tc.name, arguments: tc.arguments } };

        const approved = await new Promise((resolve) => {
          setTaskPendingApproval(sessionId, { toolCallId: tc.id, toolName: tc.name, args: tc.arguments, resolve });
          setTimeout(() => { clearTaskPendingApproval(sessionId); resolve(false); }, 300000);
        });
        clearTaskPendingApproval(sessionId);

        if (!approved) {
          const result = { denied: true, message: 'User denied tool execution' };
          toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
          yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result, denied: true } };
          stepToolResults.push({ toolName: tc.name, result });
          continue;
        }
      }

      // Execute
      const executor = allExecutors[tc.name];
      if (!executor) {
        const result = { error: `Unknown tool: ${tc.name}` };
        toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
        yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result } };
        stepToolResults.push({ toolName: tc.name, result });
        continue;
      }

      let result;
      try {
        result = await Promise.race([
          executor(tc.arguments || {}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timed out')), TOOL_TIMEOUT)),
        ]);
      } catch (err) {
        result = { error: err.message };
      }

      toolResults.push(llm.formatToolResult(provider, tc.id, tc.name, JSON.stringify(result)));
      yield { type: 'tool_result', data: { id: tc.id, name: tc.name, result } };
      stepToolResults.push({ toolName: tc.name, result });

      // ── Tier 2: Evaluate + Reflect on tool result ──
      const evaluation = evaluator.evaluate(tc.name, tc.arguments, result);

      if (evaluation.needsReflection) {
        try {
          const ref = await reflection.reflectOnToolResult(
            tc.name, tc.arguments, result,
            `${step.title}: ${step.description}`
          );
          yield { type: 'reflection', data: {
            toolName: tc.name,
            evaluation,
            reflection: ref,
          }};

          // Inject reflection context into the tool result so it stays in the
          // assistant→tool_result flow without breaking alternating message order
          if (ref.alternative) {
            const reflectionHint = `\n[Reflection: ${tc.name} ${evaluation.status === 'error' ? 'failed' : 'returned empty results'}. ` +
              `Suggested alternative: ${ref.alternative}. Confidence: ${ref.confidence}]`;
            // Append to the last tool result content (handles all provider formats)
            const lastTR = toolResults[toolResults.length - 1];
            if (lastTR) {
              if (Array.isArray(lastTR.content)) {
                // Anthropic: content is [{ type: 'tool_result', ... }] — append text block
                lastTR.content.push({ type: 'text', text: reflectionHint });
              } else if (typeof lastTR.content === 'string') {
                // OpenAI/XAI/fallback: content is a string — concatenate
                lastTR.content += reflectionHint;
              } else if (Array.isArray(lastTR.parts)) {
                // Gemini: parts array — append text part
                lastTR.parts.push({ text: reflectionHint });
              }
            }
          }
        } catch {}
      }
    }

    messages.push(...toolResults);
    summary = fullText;
  }

  return { success: true, summary: summary || 'Max iterations for step', iterations: iteration, provider, toolResults: stepToolResults };
}

// ── Main Task Engine (async generator) ──
async function* runTaskEngine(goal, db, userId, sessionId) {
  if (!sessionId) sessionId = uuidv4();
  const now = new Date().toISOString();

  yield { type: 'session', data: { sessionId } };

  // ── Phase 1: Planning ──
  yield { type: 'phase', data: { phase: 'planning' } };

  let plan;
  try {
    // Save initial session
    try {
      db.prepare('INSERT OR REPLACE INTO task_sessions (id, user_id, goal, status, plan, results, current_step, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(sessionId, userId, goal, 'planning', '[]', '[]', 0, now, now);
    } catch {}

    plan = await generatePlan(goal, db);
    yield { type: 'plan', data: { steps: plan } };

    // Save plan to DB
    try {
      db.prepare('UPDATE task_sessions SET plan = ?, status = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(plan), 'executing', new Date().toISOString(), sessionId);
    } catch {}
  } catch (err) {
    yield { type: 'error', data: `Plan generation failed: ${err.message}` };
    try {
      db.prepare('UPDATE task_sessions SET status = ?, updated_at = ? WHERE id = ?')
        .run('failed', new Date().toISOString(), sessionId);
    } catch (dbErr) {
      console.error('[TaskEngine] Failed to update session status:', dbErr.message);
    }
    return;
  }

  // ── Phase 2: Execution ──
  yield { type: 'phase', data: { phase: 'executing' } };

  const results = [];
  let totalIterations = 0;
  let allSuccess = true;
  let replanCount = 0;

  for (let i = 0; i < plan.length; i++) {
    const step = plan[i];
    yield { type: 'step_start', data: { stepIndex: i, step } };

    // Update current step in DB
    try {
      db.prepare('UPDATE task_sessions SET current_step = ?, updated_at = ? WHERE id = ?')
        .run(i, new Date().toISOString(), sessionId);
    } catch {}

    try {
      const stepGen = executeStep(step, i, goal, results, sessionId, db, userId);
      let stepResult = null;

      for await (const event of stepGen) {
        // Check if this is the final return value
        if (event.success !== undefined) {
          stepResult = event;
          break;
        }
        yield event;
      }

      // executeStep returns the result as the return value of the generator
      if (!stepResult) {
        stepResult = { success: true, summary: 'Step completed', iterations: 0, toolResults: [] };
      }

      totalIterations += stepResult.iterations || 0;
      results.push({ stepIndex: i, ...stepResult });

      // ── Tier 2: Step-level reflection ──
      let stepReflection = null;
      if (stepResult.toolResults && stepResult.toolResults.length > 0) {
        try {
          stepReflection = await reflection.reflectOnStep(step, stepResult.toolResults, goal);
        } catch {}
      }

      // ── Tier 2: Store experience ──
      try {
        await experience.storeExperience(db, {
          taskSessionId: sessionId,
          stepIndex: i,
          goalSummary: `${step.title}: ${step.description}`.slice(0, 500),
          toolSequence: (stepResult.toolResults || []).map(tr => tr.toolName),
          outcome: stepResult.success ? 'success' : 'failure',
          reflectionNotes: stepReflection?.lessonsLearned || null,
          errorType: stepResult.success ? null : (stepResult.toolResults?.find(tr => tr.result?.error)?.result?.error?.slice(0, 200) || null),
          recoveryAction: stepReflection?.suggestedChanges || null,
          confidence: stepReflection?.stepSuccess ? 0.8 : 0.3,
        });
      } catch {}

      yield { type: 'step_complete', data: { stepIndex: i, summary: stepResult.summary, success: stepResult.success } };

      // ── Tier 2: Adaptive Replan on critical failure ──
      if (!stepResult.success && step.critical) {
        allSuccess = false;

        if (replanCount < MAX_REPLANS) {
          try {
            const replanResult = await reflection.shouldReplan(
              plan,
              results.filter(r => r.success),
              { index: i, step, error: stepResult.summary },
              goal
            );

            if (replanResult.shouldReplan && replanResult.newSteps?.length) {
              replanCount++;
              // Splice new steps into the plan, replacing remaining steps
              const newSteps = replanResult.newSteps;
              plan.splice(i + 1, plan.length - i - 1, ...newSteps);

              yield { type: 'replan', data: {
                reason: replanResult.reasoning,
                failedStep: i,
                newSteps,
                replanCount,
              }};

              // Update plan in DB
              try {
                db.prepare('UPDATE task_sessions SET plan = ?, updated_at = ? WHERE id = ?')
                  .run(JSON.stringify(plan), new Date().toISOString(), sessionId);
              } catch {}

              // Continue execution with new plan (don't break)
              continue;
            }
          } catch {}
        }

        yield { type: 'error', data: `Critical step ${i + 1} failed: ${stepResult.summary}` };
        break;
      }

      if (!stepResult.success) {
        allSuccess = false;
      }

      // Save intermediate results
      try {
        db.prepare('UPDATE task_sessions SET results = ?, updated_at = ? WHERE id = ?')
          .run(JSON.stringify(results), new Date().toISOString(), sessionId);
      } catch {}

      // Check total iteration budget
      if (totalIterations >= MAX_TOTAL_ITERATIONS) {
        yield { type: 'error', data: `Total iteration budget exhausted (${MAX_TOTAL_ITERATIONS})` };
        break;
      }
    } catch (err) {
      const stepResult = { stepIndex: i, success: false, summary: err.message, iterations: 0, toolResults: [] };
      results.push(stepResult);
      yield { type: 'step_complete', data: { stepIndex: i, summary: err.message, success: false } };

      if (step.critical) {
        allSuccess = false;
        yield { type: 'error', data: `Critical step ${i + 1} failed: ${err.message}` };
        break;
      }
    }
  }

  // ── Complete ──
  yield { type: 'phase', data: { phase: 'complete' } };

  const completedCount = results.filter(r => r.success).length;
  const summaryText = `Completed ${completedCount}/${plan.length} steps${allSuccess ? ' successfully' : ' with some failures'}`;

  yield { type: 'task_complete', data: { success: allSuccess, summary: summaryText, stepsCompleted: completedCount, totalSteps: plan.length } };

  // Save final state
  try {
    db.prepare('UPDATE task_sessions SET status = ?, results = ?, current_step = ?, updated_at = ? WHERE id = ?')
      .run(allSuccess ? 'completed' : 'failed', JSON.stringify(results), plan.length, new Date().toISOString(), sessionId);
  } catch {}

  // Tier 3: Record goal completion for pattern learning
  try {
    usageTracker.recordGoalCompletion(db, userId, goal, allSuccess, plan.length);
  } catch {}
}

module.exports = {
  runTaskEngine,
  generatePlan,
  getExtendedTools,
  getTaskPendingApproval,
  setTaskPendingApproval,
  clearTaskPendingApproval,
};
