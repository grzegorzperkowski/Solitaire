import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { createGame } from '../src/engine/cards.js';
import { applyMove, assertInvariants, getLegalMoves, isWon, validateMove } from '../src/engine/game.js';

// SplitMix32 action selector. It is not the engine Mulberry32 shuffle.
const SELECTOR_INCREMENT = 0x9E3779B9;
const MAX_SEED = 4294967295;

export const PROFILES = {
  ci: { seedCount: 1000, maxSteps: 300 },
  release: { seedCount: 10000, maxSteps: 1000 },
};

export function parseProfile(argv) {
  let profile;
  let sawFlag = false;
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--profile') {
      sawFlag = true;
      const value = argv[index + 1];
      if (value === undefined || value.startsWith('--')) return { ok: false, profile: null };
      profile = value;
      index += 1;
    } else if (arg.startsWith('--profile=')) {
      sawFlag = true;
      profile = arg.slice('--profile='.length);
    }
  }
  if (!sawFlag) return { ok: false, profile: null };
  if (!Object.hasOwn(PROFILES, profile)) return { ok: false, profile };
  return { ok: true, profile };
}

export function selectorSeed(seed, drawCount) {
  return (seed + Math.imul(drawCount, 0x6C62272E)) >>> 0;
}

function createSelector(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + SELECTOR_INCREMENT) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21F0AAAD);
    mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735A2D97);
    return (mixed ^ (mixed >>> 15)) >>> 0;
  };
}

export function simulationFailure(trace) {
  const error = new Error(`simulation failed: ${JSON.stringify(trace)}`);
  error.trace = trace;
  return error;
}

function fail(context, assertion) {
  throw simulationFailure({
    seed: context.seed,
    drawCount: context.drawCount,
    rulesVersion: context.rulesVersion,
    shuffleVersion: context.shuffleVersion,
    selectorSeed: context.selectorSeed,
    step: context.step,
    actionHistory: context.history,
    assertion,
  });
}

function emptyCategories() {
  return { draw: 0, recycle: 0, tableau: 0, waste: 0, foundation: 0, invalid: 0 };
}

function categoryOf(command) {
  if (command.type === 'draw') return 'draw';
  if (command.type === 'recycle') return 'recycle';
  return command.from.pile;
}

// 0 prefers a reveal or a foundation build, 1 prefers draw/recycle,
// 2 prefers a foundation return. An empty preference falls back to any legal move.
function preferred(command, state, bias) {
  if (bias === 1) return command.type === 'draw' || command.type === 'recycle';
  if (bias === 2) return command.type === 'move' && command.from.pile === 'foundation';
  if (command.type !== 'move') return false;
  if (command.to.pile === 'foundation') return true;
  if (command.from.pile !== 'tableau') return false;
  const column = state.tableau[command.from.index];
  return command.from.cardIndex === column.faceUpStart && column.faceUpStart > 0;
}

function rejectedCommands(state) {
  const candidates = [
    null,
    { type: 'draw', extra: true },
    { type: 'recycle', extra: true },
    { type: 'move' },
    { type: 'nope' },
    { type: 'draw' },
    { type: 'recycle' },
    { type: 'move', from: { pile: 'waste' }, to: { pile: 'tableau', index: 0 } },
    {
      type: 'move',
      from: { pile: 'tableau', index: 0, cardIndex: 99 },
      to: { pile: 'foundation', index: 0 },
    },
  ];
  return candidates.filter((command) => !validateMove(state, command).ok);
}

function assertPlayable(state, context) {
  try {
    assertInvariants(state);
  } catch (error) {
    fail(context, error.message);
  }
  const placed = state.foundations.reduce((sum, pile) => sum + pile.length, 0);
  if (placed !== 52 && isWon(state)) fail(context, 'won before 52 foundation cards');
}

function assertEnumerated(state, legal, context) {
  const seen = new Set();
  for (const move of legal) {
    const key = JSON.stringify(move);
    if (seen.has(key)) fail(context, `duplicate move ${key}`);
    seen.add(key);
    if (!validateMove(state, move).ok) fail(context, `enumerated move rejected ${key}`);
  }
}

function applyLegal(state, command, context) {
  const before = JSON.stringify(state);
  let validated;
  let applied;
  try {
    validated = validateMove(state, command);
    applied = applyMove(state, command);
  } catch (error) {
    fail(context, `legal action threw ${error.message}`);
  }
  if (!validated.ok || !applied.ok) fail(context, 'legal action rejected');
  if (JSON.stringify(state) !== before) fail(context, 'legal action mutated the input');
  if (applied.revealed !== null && !Number.isInteger(applied.revealed)) {
    fail(context, 'reveal is not a card id');
  }
  context.history.push(command);
  context.step += 1;
  assertPlayable(applied.state, context);
  return applied.state;
}

function applyInvalid(state, command, context) {
  const before = JSON.stringify(state);
  let validated;
  let applied;
  try {
    validated = validateMove(state, command);
    applied = applyMove(state, command);
  } catch (error) {
    fail(context, `invalid action threw ${error.message}`);
  }
  if (validated.ok || applied.ok || validated.reason !== applied.reason) {
    fail(context, 'invalid action changed acceptance');
  }
  if (JSON.stringify(state) !== before) fail(context, 'invalid action mutated the input');
  context.history.push(command);
  context.step += 1;
  return state;
}

// Moves and rejections only. Undo, redo and restore are T006 and T007.
export function simulateDeal({ seed, drawCount, maxSteps, rulesVersion = 1, shuffleVersion = 1 }) {
  let state = createGame({ seed, drawCount, rulesVersion, shuffleVersion });
  const context = {
    seed,
    drawCount,
    rulesVersion: state.rulesVersion,
    shuffleVersion: state.shuffleVersion,
    selectorSeed: selectorSeed(seed, drawCount),
    step: 0,
    history: [],
  };
  assertPlayable(state, context);
  const selector = createSelector(context.selectorSeed);
  const bias = (seed + drawCount) % 3;
  const categories = emptyCategories();
  let stopped = 'bound';

  while (context.step < maxSteps) {
    if (isWon(state)) {
      stopped = 'win';
      break;
    }
    const legal = getLegalMoves(state);
    assertEnumerated(state, legal, context);
    if (legal.length === 0) {
      stopped = 'stuck';
      break;
    }
    if (selector() % 5 === 0) {
      const rejected = rejectedCommands(state);
      if (rejected.length === 0) fail(context, 'no invalid command');
      const command = rejected[selector() % rejected.length];
      state = applyInvalid(state, command, context);
      categories.invalid += 1;
      continue;
    }
    const matching = legal.filter((command) => preferred(command, state, bias));
    const pool = matching.length > 0 ? matching : legal;
    const command = pool[selector() % pool.length];
    state = applyLegal(state, command, context);
    categories[categoryOf(command)] += 1;
  }

  if (isWon(state)) stopped = 'win';
  return {
    steps: context.step,
    stopped,
    categories,
    history: context.history,
    state,
    selectorSeed: context.selectorSeed,
  };
}

export function simulateProfile(name) {
  const profile = PROFILES[name];
  if (!profile) throw new Error(`unknown simulation profile: ${name}`);
  const report = {
    profile: name,
    deals: 0,
    steps: 0,
    maxSteps: profile.maxSteps,
    seedCount: profile.seedCount,
    wins: 0,
    stuck: 0,
    bound: 0,
    won: [],
    categories: emptyCategories(),
  };
  const seeds = [];
  for (let seed = 0; seed < profile.seedCount; seed += 1) seeds.push(seed);
  seeds.push(MAX_SEED);
  for (const drawCount of [1, 3]) {
    for (const seed of seeds) {
      const result = simulateDeal({ seed, drawCount, maxSteps: profile.maxSteps });
      report.deals += 1;
      report.steps += result.steps;
      if (result.stopped === 'win') {
        report.wins += 1;
        report.won.push({ seed, drawCount, steps: result.steps });
      } else if (result.stopped === 'stuck') report.stuck += 1;
      else if (result.stopped === 'bound') report.bound += 1;
      else throw new Error(`unknown simulation stop: ${result.stopped}`);
      for (const key of Object.keys(report.categories)) {
        report.categories[key] += result.categories[key];
      }
    }
  }
  return report;
}

function main() {
  const parsed = parseProfile(process.argv);
  if (!parsed.ok) {
    console.error(`unknown simulation profile: ${parsed.profile ?? '(missing)'}`);
    process.exit(1);
  }
  const require = createRequire(import.meta.url);
  const vitestBin = join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
  const result = spawnSync(process.execPath, [vitestBin, 'run', 'tests/unit/simulation.test.js'], {
    stdio: 'inherit',
    env: { ...process.env, SOLITAIRE_SIMULATION_PROFILE: parsed.profile },
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  process.exit(result.status === null ? 1 : result.status);
}

if (basename(process.argv[1] ?? '') === 'run-simulation.mjs') main();
