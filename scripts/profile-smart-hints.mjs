import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { restoreSession } from '../src/persistence.js';
import { h09 } from '../tests/fixtures/smart-hints.js';
import { visibleCards } from '../src/engine/knowledge.js';

const revision = process.argv[2] || 'working';
const mode = process.argv[3] || 'profile';
assert.ok(['profile', 'benchmark'].includes(mode));
let source = revision === 'working' ? readFileSync('src/engine/smart-hints.js', 'utf8')
  : execFileSync('git', ['show', `${revision}:src/engine/smart-hints.js`], { encoding: 'utf8' });
// Load matching engine code too: a historical planner must not use optimized current helpers.
const modules = new Map();
async function moduleUrl(file) {
  if (revision === 'working') return pathToFileURL(path.resolve('src/engine', file)).href;
  if (modules.has(file)) return modules.get(file);
  let code = execFileSync('git', ['show', `${revision}:src/engine/${file}`], { encoding: 'utf8' });
  for (const match of [...code.matchAll(/from '\.\/(.*?)'/g)]) {
    code = code.replace(match[0], `from '${await moduleUrl(match[1])}'`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  modules.set(file, url);
  return url;
}
for (const match of [...source.matchAll(/from '\.\/(.*?)'/g)]) {
  source = source.replace(match[0], `from '${await moduleUrl(match[1])}'`);
}
if (mode === 'profile') {
  source = source.replace('applyMove, getLegalMoves,', 'applyMove as rawApplyMove, getLegalMoves as rawGetLegalMoves,')
    .replace('import { progressStateKey }', 'import { progressStateKey as rawProgressStateKey }')
    .replace('import { progressKeyFor, progressStateKey }',
      'import { progressKeyFor as rawProgressKeyFor, progressStateKey as rawProgressStateKey }')
    .replace('function evaluateSequence(', 'function rawEvaluateSequence(')
    .replace('function verifyEndState(', 'function rawVerifyEndState(');
  source += `
export const measurements = {};
const timingStack = [];
function measured(name, fn, args) {
  const frame = { children: 0, start: performance.now() };
  timingStack.push(frame);
  try { return fn(...args); } finally {
    const elapsed = performance.now() - frame.start;
    timingStack.pop();
    if (timingStack.length) timingStack.at(-1).children += elapsed;
    const row = measurements[name] ||= { calls: 0, inclusiveMs: 0, ownMs: 0 };
    row.calls++; row.inclusiveMs += elapsed; row.ownMs += elapsed - frame.children;
  }
}
const applyMove = (...args) => measured('applyMove', rawApplyMove, args);
const getLegalMoves = (...args) => measured('getLegalMoves', rawGetLegalMoves, args);
const progressStateKey = (...args) => measured('progressStateKey', rawProgressStateKey, args);
const progressKeyFor = (known) => {
  const key = rawProgressKeyFor(known);
  return (...args) => measured('progressStateKey', key, args);
};
const evaluateSequence = (...args) => measured('evaluateSequence', rawEvaluateSequence, args);
const verifyEndState = (...args) => measured('verifyEndState', rawVerifyEndState, args);
`;
  source = source.replace('// Read the already explored graph;',
    "const verificationStart = performance.now(); try {\n// Read the already explored graph;");
  const end = source.indexOf('\nexport const measurements');
  const lastBrace = source.lastIndexOf('}', end);
  source = source.slice(0, lastBrace) +
    '} finally { measurements.graphVerificationMs = performance.now() - verificationStart; }\n' + source.slice(lastBrace);
}
const planner = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const diagnostic = JSON.parse(readFileSync('tests/fixtures/solitaire-stan-2560240634-draw1-73.json', 'utf8'));
const restored = restoreSession(JSON.stringify(diagnostic.save));
assert.equal(restored.ok, true);
const cases = [['cursor73', restored.session.state, restored.session.knownCards, { maxStates: 250000, maxDepth: 100 }],
  ['H09', h09(), visibleCards(h09()), { maxStates: 1000, maxDepth: 8 }]];
for (const [fixture, state, known, options] of cases) {
  let expected;
  for (let run = 0; run < (mode === 'benchmark' ? 3 : 1); run++) {
    if (planner.measurements) for (const key of Object.keys(planner.measurements)) delete planner.measurements[key];
    const unchanged = JSON.stringify(state);
    const start = performance.now();
    const iterator = planner.searchSmartHint(state, known, options);
    let step;
    do { step = iterator.next(); } while (!step.done);
    const ms = performance.now() - start;
    assert.equal(JSON.stringify(state), unchanged);
    const result = step.value;
    const comparable = { status: result.status, goal: result.goal, plan: result.plan, score: result.score,
      expanded: result.visitedStates, truncated: result.truncated, diagnostics: result.diagnostics };
    if (expected) assert.deepEqual(comparable, expected);
    expected = comparable;
    if (fixture === 'cursor73') {
      assert.equal(result.status, 'NO_STRATEGIC_PROGRESS');
      assert.equal(result.truncated, false);
      assert.equal(result.visitedStates, 88896);
    }
    console.log(JSON.stringify({ revision, mode, fixture, run, ms: Math.round(ms), ...comparable,
      measurements: planner.measurements }));
  }
}
