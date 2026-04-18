/**
 * Tool Result Evaluator — Zero-LLM result classifier
 * Instantly classifies tool results without any LLM call.
 * Short-circuits ~60% of reflection calls by detecting clear success/error patterns.
 */

// ── Error Pattern Matchers ──
const FILE_NOT_FOUND = /no such file|not found|enoent|does not exist/i;
const PERMISSION_DENIED = /permission denied|eacces|eperm|access denied|not permitted/i;
const TIMEOUT_PATTERN = /timed? ?out|etimedout|timeout|deadline exceeded/i;
const SECURITY_BLOCKED = /blocked|dangerous command|path outside home/i;
const TRUNCATED_PATTERN = /\.\.\. \(\d+ more lines?\)$/;

/**
 * Classify a tool result without LLM.
 * @param {string} toolName - Name of the tool that was called
 * @param {object} args - Arguments passed to the tool
 * @param {object} result - The tool execution result
 * @returns {{ status, errorType, needsReflection, outputQuality }}
 */
function evaluate(toolName, args, result) {
  // Default response
  const out = {
    status: 'success',
    errorType: null,
    needsReflection: false,
    outputQuality: 'good',
  };

  // Null / undefined result
  if (!result) {
    return { status: 'error', errorType: 'no_result', needsReflection: true, outputQuality: 'empty' };
  }

  // ── Denied (skip reflection entirely) ──
  if (result.denied) {
    return { status: 'denied', errorType: null, needsReflection: false, outputQuality: 'empty' };
  }

  // ── Explicit error field ──
  if (result.error) {
    const errMsg = String(result.error);
    let errorType = 'unknown';

    if (FILE_NOT_FOUND.test(errMsg)) errorType = 'file_not_found';
    else if (PERMISSION_DENIED.test(errMsg)) errorType = 'permission_denied';
    else if (TIMEOUT_PATTERN.test(errMsg)) errorType = 'timeout';
    else if (SECURITY_BLOCKED.test(errMsg)) errorType = 'security_blocked';
    else if (result.blocked) errorType = 'security_blocked';

    // Security blocks don't need reflection — they're policy, not recoverable
    const needsReflection = errorType !== 'security_blocked';
    return { status: 'error', errorType, needsReflection, outputQuality: 'error_message' };
  }

  // ── Non-zero exit code (run_command) ──
  if (result.exitCode !== undefined && result.exitCode !== 0) {
    return { status: 'error', errorType: 'command_failed', needsReflection: true, outputQuality: 'error_message' };
  }

  // ── Empty results ──
  if (_isEmpty(toolName, result)) {
    // Empty search results are ambiguous — might need different query
    const ambiguous = ['search_files', 'list_directory'].includes(toolName);
    return { status: 'empty', errorType: null, needsReflection: ambiguous, outputQuality: 'empty' };
  }

  // ── Truncated output ──
  if (_isTruncated(result)) {
    return { status: 'partial', errorType: null, needsReflection: false, outputQuality: 'truncated' };
  }

  // ── task_progress — always success, never needs reflection ──
  if (toolName === 'task_progress') {
    return { status: 'success', errorType: null, needsReflection: false, outputQuality: 'good' };
  }

  // ── Success — no reflection needed ──
  return out;
}

/**
 * Check if a result is effectively empty
 */
function _isEmpty(toolName, result) {
  // search_files with 0 matches
  if (result.count === 0) return true;
  if (Array.isArray(result.files) && result.files.length === 0) return true;
  if (Array.isArray(result.items) && result.items.length === 0) return true;

  // read_file with empty content
  if (toolName === 'read_file' && result.content !== undefined && result.content.trim() === '') return true;

  // run_command with no output
  if (toolName === 'run_command' && result.exitCode === 0 && !result.stdout?.trim()) return false; // empty stdout on success is fine

  return false;
}

/**
 * Check if output was truncated
 */
function _isTruncated(result) {
  if (typeof result.content === 'string' && TRUNCATED_PATTERN.test(result.content)) return true;
  if (typeof result.stdout === 'string' && result.stdout.length >= 9900) return true; // near 10k limit
  if (typeof result.output === 'string' && result.output.length >= 9900) return true;
  return false;
}

module.exports = { evaluate };
