import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadPlanners } from './smart-hint-bfs.mjs';
import { parseOptions, playDeal, summarizeGames, compareGames } from '../hint-benchmark.js';

export function createFallback(primarySearch, secondarySearch) {
  return function* (state, known, options = {}) {
    const total = options.maxStates ?? 10000;
    assert(Number.isSafeInteger(total) && total >= 2 && total % 2 === 0, 'E1 needs an even total state ceiling >=2');
    const perRun = { ...options, maxStates: total / 2 };
    const primary = yield* primarySearch(state, known, perRun);
    const decorate = (result, used) => ({ ...result,
      visitedStates: primary.visitedStates + (used ? result.visitedStates : 0),
      diagnostics: { ...result.diagnostics, fallback: { used,
        primaryVisited: primary.visitedStates, secondaryVisited: used ? result.visitedStates : 0,
        primaryWork: primary.diagnostics?.work, secondaryWork: used ? result.diagnostics?.work : undefined } } });
    if (primary.status !== 'INCONCLUSIVE' || options.signal?.aborted) return decorate(primary, false);
    // Give the caller a cancellation point between independent searches.
    yield decorate(primary, false);
    if (options.signal?.aborted) return { ...decorate(primary, false), truncated: true, cancelled: true, phase: 'CANCELLED' };
    const iterator = secondarySearch(state, known, perRun);
    let step;
    try {
      do {
        step = iterator.next();
        if (!step.done) yield decorate(step.value, true);
      } while (!step.done);
    } finally { iterator.return(); }
    const secondary = step.value;
    if (['FOUND', 'EXPLORATION'].includes(secondary.status)) return decorate(secondary, true);
    return { ...decorate(primary, false), visitedStates: primary.visitedStates + secondary.visitedStates,
      truncated: primary.truncated || secondary.truncated,
      cancelled: Boolean(secondary.cancelled),
      ...(secondary.cancelled ? { phase: 'CANCELLED', reason: 'CANCELLED' } : {}),
      diagnostics: { ...primary.diagnostics, fallback: { ...decorate(secondary, true).diagnostics.fallback,
        secondaryStatus: secondary.status } } };
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  assert.equal(options.budget, 'states');
  assert(options.maxStates % 2 === 0);
  const { baseline, bfs, metadata } = await loadPlanners({ observe: true });
  const fallback = createFallback(baseline.searchSmartHint, bfs.searchSmartHint);
  const report = { createdAt: new Date().toISOString(), node: process.version, ...metadata, options,
    meaning: 'previous=BestFirst(total), current=BestFirst(total/2) then FIFO(total/2) after final INCONCLUSIVE; instrumented, no clock cutoff.', games: [] };
  mkdirSync(path.dirname(options.output), { recursive: true });
  for (const drawCount of [1, 3]) for (let seed = options.startSeed; seed < options.startSeed + options.count; seed++) {
    const algorithms = [{ id: 'previous', search: baseline.searchSmartHint, cancellable: true },
      { id: 'current', search: fallback, cancellable: true }];
    if (seed % 2) algorithms.reverse();
    for (const algorithm of algorithms) {
      const work = { applyMovesSearch: 0, applyMovesReplay: 0, applyMovesShortening: 0, getLegalMoves: 0, evaluations: 0,
        fallbackCalls: 0, fallbackRescues: 0 };
      const measured = { ...algorithm, search: function* (...args) {
        const result = yield* algorithm.search(...args);
        const f = result.diagnostics?.fallback;
        for (const w of f ? [f.primaryWork, f.secondaryWork] : [result.diagnostics?.work]) {
          if (w) for (const key of ['applyMovesSearch', 'applyMovesReplay', 'applyMovesShortening', 'getLegalMoves', 'evaluations']) work[key] += w[key];
        }
        if (f?.used) { work.fallbackCalls++; if (result.plan.length) work.fallbackRescues++; }
        return result;
      } };
      const game = playDeal(measured, seed, drawCount, options);
      assert(game.calls.every(c => !c.preparationOnly && c.visitedStates <= options.maxStates));
      report.games.push({ ...game, work });
    }
    writeFileSync(options.output, JSON.stringify(report));
    console.log(JSON.stringify({ drawCount, seed, games: report.games.slice(-2).map(({ algorithm, stop, steps, work }) => ({ algorithm, stop, steps, work })) }));
  }
  const summary = { ...report, games: report.games.map(({ history, calls, ...game }) => game),
    summaries: Object.fromEntries(['previous', 'current'].map(id => [id, summarizeGames(report.games.filter(g => g.algorithm === id))])),
    paired: compareGames(report.games) };
  writeFileSync(options.output.replace(/\.json$/, '') + '-summary.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ summaries: summary.summaries, paired: summary.paired }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
