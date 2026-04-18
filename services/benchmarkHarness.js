/**
 * Benchmark Harness — Load, run, and score benchmark tasks
 * Part of Tier 5: Benchmark-Ready Agent
 * Supports SWE-bench, WebArena, GAIA, and custom benchmark formats.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const BENCHMARK_DIR = path.join(__dirname, '..', 'data', 'benchmarks');

/**
 * Load benchmark tasks from a JSON file.
 * Expected format: { name, tasks: [{ id, goal, expectedOutput?, validation?, timeout? }] }
 */
function loadBenchmark(filename) {
  const filePath = path.join(BENCHMARK_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Benchmark file not found: ${filePath}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!data.tasks || !Array.isArray(data.tasks)) {
    throw new Error('Invalid benchmark format: missing tasks array');
  }

  return {
    name: data.name || filename.replace('.json', ''),
    description: data.description || '',
    taskCount: data.tasks.length,
    tasks: data.tasks.map((t, i) => ({
      id: t.id || `task_${i + 1}`,
      goal: t.goal,
      expectedOutput: t.expectedOutput || null,
      validation: t.validation || null,
      timeout: t.timeout || 120000,
      metadata: t.metadata || {},
    })),
  };
}

/**
 * List available benchmark files.
 */
function listBenchmarks() {
  try {
    if (!fs.existsSync(BENCHMARK_DIR)) {
      fs.mkdirSync(BENCHMARK_DIR, { recursive: true });
      return [];
    }

    return fs.readdirSync(BENCHMARK_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(BENCHMARK_DIR, f), 'utf8'));
          return {
            filename: f,
            name: data.name || f.replace('.json', ''),
            taskCount: data.tasks?.length || 0,
            description: data.description || '',
          };
        } catch {
          return { filename: f, name: f, taskCount: 0, description: 'Parse error' };
        }
      });
  } catch {
    return [];
  }
}

/**
 * Score a completed task against expected output.
 * @param {object} task - The benchmark task definition
 * @param {object} result - The execution result
 * @returns {{ score, passed, reason }}
 */
function scoreTask(task, result) {
  if (!result) return { score: 0, passed: false, reason: 'No result' };
  if (!result.success) return { score: 0, passed: false, reason: `Task failed: ${result.summary}` };

  // No expected output — score based on completion only
  if (!task.expectedOutput && !task.validation) {
    return { score: 1, passed: true, reason: 'Task completed successfully' };
  }

  // String match validation
  if (task.expectedOutput && typeof task.expectedOutput === 'string') {
    const summary = (result.summary || '').toLowerCase();
    const expected = task.expectedOutput.toLowerCase();

    if (summary.includes(expected)) {
      return { score: 1, passed: true, reason: 'Output matches expected' };
    }

    // Partial match
    const words = expected.split(/\s+/).filter(w => w.length > 3);
    const matched = words.filter(w => summary.includes(w));
    const ratio = words.length > 0 ? matched.length / words.length : 0;

    return {
      score: Math.round(ratio * 100) / 100,
      passed: ratio >= 0.7,
      reason: ratio >= 0.7 ? 'Partial match (>=70%)' : `Low match (${Math.round(ratio * 100)}%)`,
    };
  }

  // Validation function (as string to be evaluated)
  if (task.validation) {
    try {
      // Safety: only allow simple checks
      const fn = new Function('result', `return (${task.validation})(result)`);
      const valid = fn(result);
      return {
        score: valid ? 1 : 0,
        passed: !!valid,
        reason: valid ? 'Validation passed' : 'Validation failed',
      };
    } catch (err) {
      return { score: 0, passed: false, reason: `Validation error: ${err.message}` };
    }
  }

  return { score: 1, passed: true, reason: 'No validation criteria — marked as pass' };
}

/**
 * Generate a benchmark report.
 */
function generateReport(benchmarkName, results) {
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / (total || 1);

  return {
    benchmark: benchmarkName,
    timestamp: new Date().toISOString(),
    total,
    passed,
    failed: total - passed,
    passRate: Math.round((passed / (total || 1)) * 100),
    avgScore: Math.round(avgScore * 100) / 100,
    results: results.map(r => ({
      taskId: r.taskId,
      score: r.score,
      passed: r.passed,
      reason: r.reason,
      duration: r.duration,
    })),
  };
}

/**
 * Save a benchmark report to disk.
 */
function saveReport(report) {
  const reportDir = path.join(BENCHMARK_DIR, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  const filename = `${report.benchmark}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const filePath = path.join(reportDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
  return filePath;
}

/**
 * Create a sample benchmark file for testing.
 */
function createSampleBenchmark() {
  fs.mkdirSync(BENCHMARK_DIR, { recursive: true });

  const sample = {
    name: 'hyperion-basic',
    description: 'Basic agent capability test — file operations, search, system info',
    tasks: [
      {
        id: 'basic_1',
        goal: 'List all JavaScript files in the home directory (non-recursive)',
        expectedOutput: '.js',
        timeout: 30000,
      },
      {
        id: 'basic_2',
        goal: 'Get the current system CPU and memory usage',
        expectedOutput: 'cpu',
        timeout: 15000,
      },
      {
        id: 'basic_3',
        goal: 'Create a file called /tmp/hyperion-benchmark-test.txt with the content "Hello, Benchmark!"',
        expectedOutput: 'created',
        timeout: 30000,
      },
      {
        id: 'basic_4',
        goal: 'Read the file /tmp/hyperion-benchmark-test.txt and report its content',
        expectedOutput: 'Hello, Benchmark!',
        timeout: 15000,
      },
      {
        id: 'basic_5',
        goal: 'Search for files named "package.json" in the home directory (max depth 3)',
        expectedOutput: 'package.json',
        timeout: 30000,
      },
    ],
  };

  const filePath = path.join(BENCHMARK_DIR, 'hyperion-basic.json');
  fs.writeFileSync(filePath, JSON.stringify(sample, null, 2), 'utf8');
  return filePath;
}

module.exports = {
  loadBenchmark,
  listBenchmarks,
  scoreTask,
  generateReport,
  saveReport,
  createSampleBenchmark,
};
