/**
 * Reflection Engine — LLM-powered self-evaluation for the Task Engine
 * Called only when toolResultEvaluator says needsReflection, or at step boundaries.
 * Uses llmService.callWithFailover (non-streaming, fast 200-500ms calls).
 */

const llm = require('./llmService');

// ── Prompts (compact, JSON-only) ──

const TOOL_REFLECT_PROMPT = `You are an AI self-evaluator. Analyze this tool result and respond with ONLY a JSON object.
Given:
- Tool: {TOOL}
- Args: {ARGS}
- Result: {RESULT}
- Step context: {CONTEXT}

Respond ONLY with JSON:
{"success":bool,"errorType":"string|null","shouldRetry":bool,"alternative":"string or null — a different approach to try","confidence":0.0-1.0}

Rules:
- success: did the tool accomplish its intended purpose?
- shouldRetry: would retrying with modified args likely succeed?
- alternative: if not retrying, suggest a completely different approach (different tool, different path, etc.)
- confidence: how confident are you in this assessment?`;

const STEP_REFLECT_PROMPT = `You are an AI self-evaluator. Analyze this completed step and respond with ONLY a JSON object.
Goal: {GOAL}
Step: {STEP}
Tool results summary: {RESULTS}

Respond ONLY with JSON:
{"stepSuccess":bool,"lessonsLearned":"brief string","suggestedChanges":"string or null — what to do differently next time"}`;

const REPLAN_PROMPT = `You are a task replanner. A step in the execution plan has critically failed. Determine if the remaining plan should be modified.

Original goal: {GOAL}
Original plan: {PLAN}
Completed steps: {COMPLETED}
Failed step: {FAILED}

If the goal can still be achieved with a modified approach, respond with ONLY a JSON object:
{"shouldReplan":true,"reasoning":"brief explanation","newSteps":[{"id":N,"title":"...","description":"...","tools":["..."],"critical":true}]}

The newSteps array replaces ALL remaining (not-yet-executed) steps. Use the same format as the original plan.
Available tools: run_command, read_file, write_file, list_directory, search_files, docker_action, git_action, http_request, system_info, process_action, create_document, scaffold_project, task_progress

If the goal cannot be salvaged, respond with:
{"shouldReplan":false,"reasoning":"brief explanation"}`;

/**
 * Reflect on a single tool result.
 * Called when toolResultEvaluator returns needsReflection: true.
 * @param {string} toolName
 * @param {object} args
 * @param {object} result
 * @param {string} stepContext - Brief description of what the step is trying to do
 * @returns {{ success, errorType, shouldRetry, alternative, confidence }}
 */
async function reflectOnToolResult(toolName, args, result, stepContext) {
  const prompt = TOOL_REFLECT_PROMPT
    .replace('{TOOL}', toolName)
    .replace('{ARGS}', _compact(args))
    .replace('{RESULT}', _compact(result))
    .replace('{CONTEXT}', stepContext || 'unknown');

  try {
    const response = await llm.callWithFailover(
      [{ role: 'user', content: prompt }],
      { max_tokens: 300, temperature: 0 }
    );
    return _parseJSON(response.content, {
      success: false,
      errorType: null,
      shouldRetry: false,
      alternative: null,
      confidence: 0.5,
    });
  } catch (err) {
    // If reflection itself fails, return safe defaults
    return { success: false, errorType: 'reflection_failed', shouldRetry: false, alternative: null, confidence: 0 };
  }
}

/**
 * Reflect on a completed step (after all tool calls).
 * @param {object} step - The step definition { title, description }
 * @param {Array} toolResults - Array of { toolName, result } from this step
 * @param {string} goal - The overall task goal
 * @returns {{ stepSuccess, lessonsLearned, suggestedChanges }}
 */
async function reflectOnStep(step, toolResults, goal) {
  const resultsSummary = toolResults.map(tr => {
    const status = tr.result?.error ? 'ERROR: ' + tr.result.error : 'OK';
    return `${tr.toolName}: ${status}`;
  }).join('; ');

  const prompt = STEP_REFLECT_PROMPT
    .replace('{GOAL}', goal)
    .replace('{STEP}', `${step.title} — ${step.description}`)
    .replace('{RESULTS}', resultsSummary || 'no tools called');

  try {
    const response = await llm.callWithFailover(
      [{ role: 'user', content: prompt }],
      { max_tokens: 300, temperature: 0 }
    );
    return _parseJSON(response.content, {
      stepSuccess: true,
      lessonsLearned: '',
      suggestedChanges: null,
    });
  } catch {
    return { stepSuccess: false, lessonsLearned: 'reflection unavailable', suggestedChanges: null };
  }
}

/**
 * Determine if the plan should be revised after a critical failure.
 * Max 2 replans per session (caller tracks count).
 * @param {Array} plan - Full plan array
 * @param {Array} completedSteps - Steps that succeeded
 * @param {object} failedStep - The step that failed { index, step, error }
 * @param {string} goal - The overall task goal
 * @returns {{ shouldReplan, newSteps?, reasoning }}
 */
async function shouldReplan(plan, completedSteps, failedStep, goal) {
  const completedSummary = completedSteps.map((s, i) =>
    `Step ${i + 1}: ${s.title} — ${s.success ? 'OK' : 'FAILED'}`
  ).join('\n');

  const failedSummary = `Step ${failedStep.index + 1}: ${failedStep.step?.title} — ERROR: ${failedStep.error}`;

  const remainingSteps = plan.slice(failedStep.index + 1);
  const planSummary = plan.map((s, i) =>
    `${i + 1}. ${s.title}${s.critical ? ' [CRITICAL]' : ''}`
  ).join('\n');

  const prompt = REPLAN_PROMPT
    .replace('{GOAL}', goal)
    .replace('{PLAN}', planSummary)
    .replace('{COMPLETED}', completedSummary || 'none')
    .replace('{FAILED}', failedSummary);

  try {
    const response = await llm.callWithFailover(
      [{ role: 'user', content: prompt }],
      { max_tokens: 1024, temperature: 0.2 }
    );

    const parsed = _parseJSON(response.content, { shouldReplan: false, reasoning: 'parse error' });

    // Validate newSteps format
    if (parsed.shouldReplan && Array.isArray(parsed.newSteps) && parsed.newSteps.length > 0) {
      parsed.newSteps = parsed.newSteps.map((s, i) => ({
        id: (failedStep.index + 1) + i + 1,
        title: s.title || `Recovery Step ${i + 1}`,
        description: s.description || '',
        tools: s.tools || [],
        critical: s.critical !== false,
      }));
      return parsed;
    }

    // If shouldReplan but no valid steps, cancel replan
    if (parsed.shouldReplan) {
      return { shouldReplan: false, reasoning: parsed.reasoning || 'No valid recovery steps generated' };
    }

    return parsed;
  } catch {
    return { shouldReplan: false, reasoning: 'Replan reflection failed' };
  }
}

// ── Helpers ──

function _compact(obj) {
  try {
    const s = JSON.stringify(obj);
    return s.length > 500 ? s.slice(0, 500) + '...' : s;
  } catch {
    return String(obj).slice(0, 500);
  }
}

function _parseJSON(text, defaults) {
  try {
    const cleaned = text.trim()
      .replace(/^```(?:json)?\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

module.exports = { reflectOnToolResult, reflectOnStep, shouldReplan };
