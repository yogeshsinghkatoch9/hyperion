/**
 * Smart Suggestions Service
 * Analyzes command_history for frequent command pairs → suggest workflows.
 */

function getSuggestions(db) {
  try {
    const rows = db.prepare(
      "SELECT command, created_at FROM command_history WHERE language = 'assistant' ORDER BY created_at DESC LIMIT 200"
    ).all();

    if (rows.length < 6) return [];

    // Find command pairs that occur within 2 minutes of each other, 3+ times
    const pairCounts = {};
    for (let i = 0; i < rows.length - 1; i++) {
      const t1 = new Date(rows[i].created_at).getTime();
      const t2 = new Date(rows[i + 1].created_at).getTime();
      const diff = Math.abs(t1 - t2);

      if (diff <= 120000) { // 2 minutes
        const cmd1 = rows[i + 1].command; // earlier command first
        const cmd2 = rows[i].command;
        if (cmd1 && cmd2 && cmd1 !== cmd2) {
          const key = `${cmd1}|||${cmd2}`;
          pairCounts[key] = (pairCounts[key] || 0) + 1;
        }
      }
    }

    const suggestions = [];
    for (const [key, count] of Object.entries(pairCounts)) {
      if (count >= 3) {
        const [cmd1, cmd2] = key.split('|||');
        suggestions.push({
          type: 'workflow_suggestion',
          message: `You often run these together (${count}x). Create a workflow?`,
          commands: [cmd1, cmd2],
          frequency: count,
        });
      }
    }

    // Sort by frequency descending
    suggestions.sort((a, b) => b.frequency - a.frequency);
    return suggestions.slice(0, 5);
  } catch {
    return [];
  }
}

module.exports = { getSuggestions };
