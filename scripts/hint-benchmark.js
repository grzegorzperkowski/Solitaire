import { createGame } from '../src/engine/cards.js';
import { applyMove, assertInvariants, isWon } from '../src/engine/game.js';
import { rememberVisible, visibleCards } from '../src/engine/knowledge.js';
import { progressStateKey } from '../src/engine/progress.js';
import { rankHints } from '../src/engine/hints.js';
import { searchSmartHint as previous } from './baselines/smart-hints-90fba4f.js';
import { searchSmartHint as current, createHintContext } from '../src/engine/smart-hints.js';

export const ALGORITHMS = [
  // eslint-disable-next-line require-yield -- The rank adapter returns immediately through the planner iterator interface.
  { id: 'rank', search: function* (state) {
    const move = rankHints(state)[0];
    return { status: move ? 'FOUND' : 'INCONCLUSIVE', plan: move ? [move] : [], goal: null, visitedStates: 1, truncated: false };
  } },
  { id: 'previous', search: previous },
  { id: 'current', search: current, cancellable: true },
];

const PROFILES = {
  quick: { count: 3, maxSteps: 30, maxStates: 128, activeMs: 20, positions: 12 },
  full: { count: 100, maxSteps: 100, maxStates: 10000, activeMs: 100, positions: 100 },
};

export function parseOptions(args) {
  const values = {};
  const limits = {
    count: [1, 10000], 'start-seed': [0, 4294967295], 'max-steps': [1, 1000],
    'max-states': [1, 10000], 'max-depth': [1, 64], 'active-ms': [1, 1000], positions: [1, 1000],
  };
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/.exec(arg);
    if (!match) throw Error(`Invalid option: ${arg}; use --name=value`);
    const [, name, value] = match;
    if (Object.hasOwn(values, name)) throw Error(`Duplicate option: ${name}`);
    if (limits[name]) {
      const [min, max] = limits[name];
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
        throw Error(`Invalid ${name}: expected integer ${min}..${max}`);
      }
      values[name] = Number(value);
    } else if (name === 'profile' && Object.hasOwn(PROFILES, value) || name === 'budget' && ['states', 'time', 'both'].includes(value) || name === 'output') {
      values[name] = value;
    } else throw Error(`Unknown option or value: ${arg}`);
  }
  const profile = values.profile ?? 'quick';
  const options = { profile, ...PROFILES[profile], startSeed: 0, maxDepth: 32, budget: 'both',
    output: `.cache/hints-${profile}.json` };
  const names = { 'start-seed': 'startSeed', 'max-steps': 'maxSteps', 'max-states': 'maxStates', 'max-depth': 'maxDepth', 'active-ms': 'activeMs' };
  for (const [name, value] of Object.entries(values)) options[names[name] ?? name] = value;
  if (options.startSeed + options.count > 4294967296) throw Error('Seed range exceeds uint32');
  return options;
}

// Active computation only: same generator cutoff as the app, without scheduler waits.
export function runHint(algorithm, state, known, options, now = () => performance.now()) {
  const controller = algorithm.cancellable ? new AbortController() : null;
  const generator = algorithm.search(state, known, { maxStates: options.maxStates, maxDepth: options.maxDepth,
    signal: controller?.signal, previousHint: options.previousHint, plannerContext: options.plannerContext });
  const start = now();
  let next;
  let latest;
  do {
    next = generator.next();
    if (next.value) latest = next.value;
    if (next.done) break;
  } while (options.budget === 'states' || now() - start < options.activeMs);
  const timeCutoff = !next.done;
  if (timeCutoff) {
    if (controller) {
      controller.abort();
      next = generator.next();
      if (!next.done) { generator.return(); throw Error('planner ignored cancellation'); }
      latest = next.value;
    } else generator.return();
  }
  const elapsedMs = now() - start;
  const result = latest ?? { status: 'INCONCLUSIVE', plan: [], goal: null, visitedStates: 0 };
  return { ...result, truncated: Boolean(result.truncated || timeCutoff), elapsedMs, timeCutoff };
}

const hidden = state => state.tableau.reduce((n, c) => n + c.faceUpStart, 0);
const foundations = state => state.foundations.reduce((n, pile) => n + pile.length, 0);

// Common external measurements; neither planner's utility/goal classifier grades itself.
export function inspectPlan(state, known, plan) {
  const knownSet = new Set([...known, ...visibleCards(state)]);
  let end = state;
  let boundary = false;
  for (const move of plan) {
    if (boundary) throw Error('plan continues past an information boundary');
    const next = applyMove(end, move);
    if (!next.ok) throw Error(`illegal plan: ${next.reason}`);
    boundary = hidden(next.state) < hidden(end) || visibleCards(next.state).some(id => !knownSet.has(id));
    end = next.state;
    assertInvariants(end);
  }
  const reveal = hidden(state) - hidden(end);
  const foundationAdvance = foundations(end) - foundations(state);
  const information = visibleCards(end).some(id => !knownSet.has(id));
  return { reveal, foundationAdvance, information, preparationOnly: plan.length > 0 && reveal === 0 && foundationAdvance <= 0 && !information };
}

export function playDeal(algorithm, seed, drawCount, options, positions = [], initial = createGame({ seed, drawCount })) {
  let state = initial;
  let known = rememberVisible(state, []);
  assertInvariants(state);
  const initialHidden = hidden(state);
  const boards = new Set([progressStateKey(state, [])]);
  const observations = new Set([progressStateKey(state, known)]);
  const snapshots = [state];
  const calls = [];
  const history = [];
  let cycles = 0;
  let boardReturns = 0;
  let stop = 'MOVE_LIMIT';
  let previousHint;
  const snapshot = stage => positions.push({ id: `${algorithm.id}/${drawCount}/${seed}/${history.length}/${stage}`,
    source: algorithm.id, seed, drawCount, step: history.length, stage, state, known });
  snapshot('start');
  for (let step = 0; step < options.maxSteps; step++) {
    if (isWon(state)) { stop = 'WON'; break; }
    if (step === Math.floor(options.maxSteps / 2)) snapshot('middle');
    let result;
    let effect;
    try {
      result = runHint(algorithm, state, known, { ...options, previousHint,
        plannerContext: createHintContext(snapshots, known) });
      if (!['FOUND', 'EXPLORATION', 'INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS', 'WON'].includes(result.status) || !Array.isArray(result.plan)) throw Error('invalid result');
      if (result.status === 'WON' && !isWon(state)) throw Error('false WON');
      if (['INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS'].includes(result.status) && result.plan.length || ['FOUND', 'EXPLORATION'].includes(result.status) && !result.plan.length) throw Error('invalid result plan');
      effect = inspectPlan(state, known, result.plan);
    } catch (error) { throw Error(`${algorithm.id} seed=${seed} draw=${drawCount} step=${step}: ${error.message}`, { cause: error }); }
    calls.push({ status: result.status, goal: result.goal, planLength: result.plan.length,
      elapsedMs: result.elapsedMs, visitedStates: result.visitedStates, truncated: result.truncated,
      timeCutoff: result.timeCutoff, ...effect });
    if (['INCONCLUSIVE', 'NO_STRATEGIC_PROGRESS'].includes(result.status)) { stop = result.status; break; }
    previousHint = { state, plan: result.plan,
      commitment: result.commitment || { state, plan: result.plan } };
    const move = result.plan[0];
    state = applyMove(state, move).state;
    snapshots.push(state);
    known = rememberVisible(state, known);
    history.push(move);
    const board = progressStateKey(state, []);
    const observation = progressStateKey(state, known);
    if (boards.has(board)) boardReturns++;
    if (observations.has(observation)) cycles++;
    boards.add(board);
    observations.add(observation);
  }
  if (isWon(state)) stop = 'WON';
  snapshot('end');
  return { algorithm: algorithm.id, seed, drawCount, stop, steps: history.length,
    revealed: initialHidden - hidden(state), foundationCards: foundations(state), cycles, boardReturns, history, calls };
}

export function compareGames(games) {
  const pairs = new Map();
  for (const game of games.filter(g => g.algorithm !== 'rank')) {
    const key = `${game.drawCount}/${game.seed}`;
    if (!pairs.has(key)) pairs.set(key, {});
    const pair = pairs.get(key);
    if (pair[game.algorithm]) throw Error(`Duplicate pair ${key}`);
    pair[game.algorithm] = game;
  }
  const result = { bothWon: 0, previousOnlyWon: 0, currentOnlyWon: 0, neitherWon: 0,
    revealBetter: 0, revealWorse: 0, revealEqual: 0, meanRevealDelta: null, discordantCurrentWinShare95: null };
  let delta = 0;
  for (const pair of pairs.values()) {
    if (!pair.previous || !pair.current) throw Error('Missing previous/current pair');
    const a = pair.previous.stop === 'WON', b = pair.current.stop === 'WON';
    result[a && b ? 'bothWon' : a ? 'previousOnlyWon' : b ? 'currentOnlyWon' : 'neitherWon']++;
    const difference = pair.current.revealed - pair.previous.revealed;
    result[difference > 0 ? 'revealBetter' : difference < 0 ? 'revealWorse' : 'revealEqual']++;
    delta += difference;
  }
  if (pairs.size) result.meanRevealDelta = delta / pairs.size;
  const n = result.previousOnlyWon + result.currentOnlyWon;
  if (n) {
    const p = result.currentOnlyWon / n, z = 1.96, denominator = 1 + z * z / n;
    const center = (p + z * z / (2 * n)) / denominator;
    const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / denominator;
    result.discordantCurrentWinShare95 = [Math.max(0, center - half), Math.min(1, center + half)];
  }
  return result;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function summarizeGames(games) {
  const calls = games.flatMap(g => g.calls);
  const plans = calls.filter(c => c.planLength > 0);
  return { deals: games.length, wins: games.filter(g => g.stop === 'WON').length,
    inconclusive: games.filter(g => g.stop === 'INCONCLUSIVE').length,
    noStrategicProgress: games.filter(g => g.stop === 'NO_STRATEGIC_PROGRESS').length,
    moveLimit: games.filter(g => g.stop === 'MOVE_LIMIT').length,
    revealed: games.reduce((n, g) => n + g.revealed, 0),
    steps: games.reduce((n, g) => n + g.steps, 0), cycles: games.reduce((n, g) => n + g.cycles, 0),
    boardReturns: games.reduce((n, g) => n + g.boardReturns, 0), calls: calls.length,
    medianMs: percentile(calls.map(c => c.elapsedMs), 0.5), p95Ms: percentile(calls.map(c => c.elapsedMs), 0.95),
    medianStates: percentile(calls.map(c => c.visitedStates), 0.5), p95States: percentile(calls.map(c => c.visitedStates), 0.95),
    truncated: calls.filter(c => c.truncated).length, timeCutoffs: calls.filter(c => c.timeCutoff).length,
    recommendations: plans.length, preparationOnly: plans.filter(c => c.preparationOnly).length };
}

export function selectPositions(positions, limit) {
  const unique = new Map();
  for (const position of positions) {
    const key = progressStateKey(position.state, position.known);
    if (!unique.has(key)) unique.set(key, position);
  }
  const all = [...unique.values()];
  if (all.length <= limit) return all;
  // Even sampling across both modes and trajectories, not just the first seeds.
  return Array.from({ length: limit }, (_, i) => all[Math.floor(i * all.length / limit)]);
}
