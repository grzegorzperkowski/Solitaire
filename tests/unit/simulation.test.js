import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, test } from 'vitest';
import { createGame } from '../../src/engine/cards.js';
import { assertInvariants, isWon } from '../../src/engine/game.js';
import {
  PROFILES,
  parseProfile,
  selectorSeed,
  simulateDeal,
  simulateProfile,
  simulationFailure,
} from '../../scripts/run-simulation.mjs';

const MAX_SEED = 4294967295;
const selectedProfile = process.env.SOLITAIRE_SIMULATION_PROFILE;

function categoryTotal(categories) {
  return Object.values(categories).reduce((sum, count) => sum + count, 0);
}

test('profiles name the documented deal counts and step bounds', () => {
  expect(PROFILES.ci).toEqual({ seedCount: 1000, maxSteps: 300 });
  expect(PROFILES.release).toEqual({ seedCount: 10000, maxSteps: 1000 });
  expect(Object.keys(PROFILES).sort()).toEqual(['ci', 'release']);
});

test('profile parser accepts only ci and release', () => {
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile=ci'])).toEqual({ ok: true, profile: 'ci' });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile', 'release'])).toEqual({
    ok: true,
    profile: 'release',
  });
  expect(parseProfile(['node', 'run-simulation.mjs'])).toEqual({ ok: false, profile: null });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile='])).toEqual({ ok: false, profile: '' });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile'])).toEqual({ ok: false, profile: null });
  expect(parseProfile(['node', 'run-simulation.mjs', '--profile=nope'])).toEqual({
    ok: false,
    profile: 'nope',
  });
});

test('unknown profile exits nonzero before a game runs', () => {
  const result = spawnSync(process.execPath, ['scripts/run-simulation.mjs', '--profile=nope'], {
    encoding: 'utf8',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('nope');
});

test('action selector is not the engine mulberry32', () => {
  const source = readFileSync(new URL('../../scripts/run-simulation.mjs', import.meta.url), 'utf8');
  expect(source.includes('0x6D2B79F5')).toBe(false);
  expect(selectorSeed(0, 1)).not.toBe(selectorSeed(0, 3));
  expect(Number.isInteger(selectorSeed(MAX_SEED, 3))).toBe(true);
});

test('failure trace names the deal, selector and assertion', () => {
  const error = simulationFailure({
    seed: 7,
    drawCount: 3,
    rulesVersion: 1,
    shuffleVersion: 1,
    selectorSeed: 99,
    step: 4,
    actionHistory: [{ type: 'draw' }],
    assertion: 'invariant',
  });
  expect(error.trace).toEqual({
    seed: 7,
    drawCount: 3,
    rulesVersion: 1,
    shuffleVersion: 1,
    selectorSeed: 99,
    step: 4,
    actionHistory: [{ type: 'draw' }],
    assertion: 'invariant',
  });
  expect(error.message).toContain('invariant');
});

test('the same deal replays the same actions', () => {
  const first = simulateDeal({ seed: 42, drawCount: 1, maxSteps: 30 });
  const second = simulateDeal({ seed: 42, drawCount: 1, maxSteps: 30 });
  expect(second.history).toEqual(first.history);
  expect(first.steps).toBe(categoryTotal(first.categories));
  expect(first.steps).toBeGreaterThan(0);
  expect(first.steps).toBeLessThanOrEqual(30);
  assertInvariants(first.state);
  expect(first.state).toEqual(second.state);
  expect(isWon(first.state)).toBe(false);
});

test('draw 3 stock-biased play recycles and keeps the previous board', () => {
  const opening = createGame({ seed: 1, drawCount: 3 });
  const result = simulateDeal({ seed: 1, drawCount: 3, maxSteps: 40 });
  expect((1 + 3) % 3).toBe(1);
  expect(result.categories.draw).toBeGreaterThan(0);
  expect(result.categories.recycle).toBeGreaterThan(0);
  expect(result.categories.invalid).toBeGreaterThan(0);
  expect(result.categories.tableau).toBe(0);
  expect(result.steps).toBe(categoryTotal(result.categories));
  assertInvariants(result.state);
  assertInvariants(opening);
  expect(opening.stock).toHaveLength(24);
  expect(opening.waste).toEqual([]);
});

test('a long draw 3 run stays inside the step bound', () => {
  const result = simulateDeal({ seed: 1, drawCount: 3, maxSteps: 300 });
  expect(result.steps).toBe(300);
  expect(result.stopped).toBe('bound');
  expect(result.categories.recycle).toBeGreaterThan(1);
  assertInvariants(result.state);
  expect(isWon(result.state)).toBe(false);
});

test('progress-biased play uses a transfer when one exists', () => {
  const result = simulateDeal({ seed: 0, drawCount: 3, maxSteps: 80 });
  expect((0 + 3) % 3).toBe(0);
  const transfers = result.categories.tableau + result.categories.waste + result.categories.foundation;
  expect(transfers).toBeGreaterThan(0);
  assertInvariants(result.state);
});

test('max seed draw 1 survives a short run', () => {
  const result = simulateDeal({ seed: MAX_SEED, drawCount: 1, maxSteps: 20 });
  expect(result.state.seed).toBe(MAX_SEED);
  expect(result.state.drawCount).toBe(1);
  expect(result.steps).toBeGreaterThan(0);
  assertInvariants(result.state);
});

if (selectedProfile) {
  test(`simulation profile ${selectedProfile}`, () => {
    const profile = PROFILES[selectedProfile];
    expect(profile).toBeTruthy();
    const report = simulateProfile(selectedProfile);
    console.log(`simulation ${JSON.stringify(report)}`);
    expect(report.profile).toBe(selectedProfile);
    expect(report.deals).toBe((profile.seedCount + 1) * 2);
    expect(report.maxSteps).toBe(profile.maxSteps);
    expect(report.steps).toBeGreaterThan(0);
    expect(report.wins + report.stuck + report.bound).toBe(report.deals);
    expect(report.won).toHaveLength(report.wins);
    for (const category of ['draw', 'recycle', 'tableau', 'waste', 'foundation', 'invalid']) {
      expect(report.categories[category]).toBeGreaterThan(0);
    }
  }, 600_000);
}
