# T028 — E1 fallback R&D, 2026-10-16

IN_PROGRESS. Coordinator continued Smart Hint R&D by supplying the external diagnosis and E1 proposal. Base120aaa5, master. Work sequentially, no agents/branches/push; preserve both untracked diagnostic JSON files.

Hypothesis: Best-First(B), then FIFO(B) only after final INCONCLUSIVE, improves whole-game wins versus unchanged Best-First(2B). Preserve scoring, history, commitment, boundaries, shortening and engine. Production remains unchanged.

Plan: add observational instrumentation to the pinned experimental modules and prove unchanged results; test generator/fallback routing, streaming, cancellation and A/B/C; measure 40 paired deals at total1024 and4096 (B512/2048), depth32/500 commands/no clock cutoff. If exploratory wins improve, test an independent seed set. Record actual engine-call work; equal state ceilings are not equal CPU work. Also run a bounded independent B reachability probe and two forced-first-choice continuations from B's actual common prefix, if available. Do not infer unwinnability from limits.

Scope: scripts/experiments loader/observation/fallback runner, focused tests, reports and task tracking only. No UI, save, F04 or production strategy changes. Results/checks pending; resume only on assignment if interrupted.

## Implementation and verification

- `createFallback` accepts an even total state ceiling. Each unchanged search gets half; primary streams normally, only final INCONCLUSIVE starts FIFO. Explicit cancellation checkpoint between runs; partial secondary plans survive cancellation. Combined visitedStates is the sum of actual expansions. The result preserves commitment and cannot turn two uncertain searches into a negative proof. It follows the proposed conservative policy of keeping primary uncertainty if secondary has no recommendation.
- `observeSource` instruments pinned modules only. It records search/replay/shortening applyMove calls separately, getLegalMoves/evaluation calls, expansion histogram, first raw/accepted goal, raw goals skipped by dedup, U/history/endpoint-policy rejection, and maximum queue size. Counters snapshot at yield and do not affect ordering. Raw goals are root-relative H/F/I states on generated edges, including those beyond depth; rawGoalsBeyondDepth identifies those separately. Rejection counts overlap and are not a partition. Frontier counts queue entries, including stale ones. Benchmark verification/context construction are outside these work counts.
- Initial `npm test -- tests/unit/smart-hints-fallback.test.js`: RED, missing experiment module (exit1). Next focused run exposed an ambiguous replay instrumentation anchor (two matches); narrowed it to the shortening call site. Focused35 passed, then36 passed after additional uncertainty/commitment coverage and empty-run frontier/cancellation-phase correction.
- `npm test`: 373 passed,29 files,23.86s,exit0. Covers full existing337 tests, previous30 FIFO cases and6 fallback tests. Exact observed/unobserved A/C HintResults match after removing the added work fields; measured maximum depths reproduce A32/10 and C24/11.
- `npm run build`: exit0,35 modules, JS108.10kB/gzip32.94. Full tests/build and later diagnostic probes overlap deterministic-state measurements: elapsed fields are not speed evidence. No time cutoffs used.

## First whole-game series (complete)

`node scripts/experiments/smart-hint-fallback.mjs --budget=states --count=20 --start-seed=200 --max-steps=500 --max-states=1024 --max-depth=32 --output=.cache/T028-fallback-1024.json`

40 paired mode/seed combinations, 80 full-game trajectories. `previous`=Best-First1024; `current`=Best-First512 then FIFO512 only on final uncertainty.

| Metric | Control | Fallback |
| --- | ---: | ---: |
| Wins | 11 | 9 |
| INCONCLUSIVE | 20 | 23 |
| NO_STRATEGIC_PROGRESS | 9 | 8 |
| Reveals | 555 | 556 |
| Commands | 3395 | 3311 |
| Same board+knowledge returns | 2 | 2 |
| Search applyMove calls | 2611826 | 1483483 |
| Replay applyMove calls | 21337 | 19700 |
| Shortening applyMove calls | 36693 | 33996 |

Paired: both win9, control-only2, fallback-only0, neither29. Fallback started26 times and recovered3 local recommendations, none a new whole-game win. Zero preparation-only recommendations and zero move-limit terminations. Direct comparison to the previous saved Best-First512 trajectories verifies all9 earlier winners retain their EXACT command histories. That is distinct from superiority to the doubled control, which was not observed. Work counts show lower total work for this policy, not equal CPU and not better wins.

Source/test checkpoint pending commit. Second40-deal series at total4096 and counterfactual diagnostics remain in progress. No promotion or generalized conclusion yet.
