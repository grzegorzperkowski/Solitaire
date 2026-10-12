import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { restoreSession } from '../src/persistence.js';
import { searchSmartHint } from '../src/engine/smart-hints.js';
import { hintBfs } from '../tests/helpers/smart-hint-bfs.js';

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/audit-smart-hints.mjs <diagnostic.json>');
const diagnostic = JSON.parse(readFileSync(input, 'utf8'));
const restored = restoreSession(JSON.stringify(diagnostic.save));
if (!restored.ok) throw new Error(`Restore failed: ${restored.reason}`);
const { state, knownCards, cursor } = restored.session;
const source = execFileSync('git', ['show', 'c677cad:src/engine/smart-hints.js'], { encoding: 'utf8' })
  .replace(/from '\.\/(.*?)'/g, (_, file) => `from '${pathToFileURL(path.resolve('src/engine', file)).href}'`);
const baseline = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
console.log(JSON.stringify({ seed: state.seed, drawCount: state.drawCount, cursor,
  options: { maxStates: 250000, maxDepth: 100 }, baseline: 'c677cad' }));
for (const [label, search] of [['before', baseline.searchSmartHint], ['after', searchSmartHint]]) {
  const start = performance.now();
  const iterator = search(state, knownCards, { maxStates: 250000, maxDepth: 100 });
  let step;
  do { step = iterator.next(); } while (!step.done);
  const result = step.value;
  console.log(JSON.stringify({ label, ms: Math.round(performance.now() - start),
    status: result.status, reason: result.reason, truncated: result.truncated,
    expanded: result.visitedStates, ...result.diagnostics }));
}
const start = performance.now();
console.log(JSON.stringify({ label: 'BFS', ...hintBfs(state, knownCards), ms: Math.round(performance.now() - start) }));
