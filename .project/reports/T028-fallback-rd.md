# T028 — E1 fallback R&D, 2026-10-16

REVIEW. Coordinator continued Smart Hint R&D by supplying the external diagnosis and E1 proposal. Base120aaa5, master. Sequential implementation, no agents/branches/push; both untracked diagnostic JSON files preserved. Measurements finished; no coordinator acceptance inferred.

Hypothesis: Best-First(B), then FIFO(B) only after final INCONCLUSIVE, improves whole-game wins versus unchanged Best-First(2B). Preserve scoring, history, commitment, boundaries, shortening and engine. Production remains unchanged.

Plan: add observational instrumentation to the pinned experimental modules and prove unchanged results; test generator/fallback routing, streaming, cancellation and A/B/C; measure 40 paired deals at total1024 and4096 (B512/2048), depth32/500 commands/no clock cutoff. If exploratory wins improve, test an independent seed set. Record actual engine-call work; equal state ceilings are not equal CPU work. Also run a bounded independent B reachability probe and two forced-first-choice continuations from B's actual common prefix, if available. Do not infer unwinnability from limits.

Scope: scripts/experiments loader/observation/fallback runner, focused tests, reports and task tracking only. No UI, save, F04 or production strategy changes. Actual results and limitations follow.

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

Source/test/first-series checkpoint: `898fb7c`. Tracked [1024 summary](T028-fallback-1024-summary.json) contains per-deal results, work totals and raw SHA256.

## Second whole-game series (complete)

`node scripts/experiments/smart-hint-fallback.mjs --budget=states --count=20 --start-seed=200 --max-steps=500 --max-states=4096 --max-depth=32 --output=.cache/T028-fallback-4096.json`

Same40 mode/seed combinations, another80 trajectories. `previous`=Best-First4096; `current`=Best-First2048 then FIFO2048 only after final uncertainty. These repeated budgets are not independent new deals.

| Metric | Control | Fallback |
| --- | ---: | ---: |
| Wins | 11 | 11 |
| INCONCLUSIVE | 13 | 16 |
| NO_STRATEGIC_PROGRESS | 16 | 13 |
| Reveals | 546 | 547 |
| Commands | 3433 | 3440 |
| Same board+knowledge returns | 2 | 0 |
| Search applyMove calls | 9152647 | 5099013 |
| Replay applyMove calls | 22130 | 22243 |
| Shortening applyMove calls | 34225 | 36559 |

Paired: both win11, control-only0, fallback-only0, neither29. All11 previously saved Best-First2048 winning histories are preserved exactly. Fallback started17 times, recovered1 local recommendation and added no win. No preparation-only suggestions or move-limit terminations. Tracked [4096 summary](T028-fallback-4096-summary.json) contains per-game work and actual aggregated engine-call counts. State ceilings do not imply equal work: fallback spends only half when primary succeeds. The conservative E1 policy retains primary INCONCLUSIVE even if secondary provides no recommendation; NO_STRATEGIC_PROGRESS/INCONCLUSIVE counts therefore also reflect that policy, not solely coverage.

## Decision

Do not promote E1 as a quality improvement. At B512 it loses9:11 to the doubled control; at B2048 it ties11:11 on identical winners. It recovers local recommendations but no additional whole-game win in either series. It uses fewer engine calls, which may be useful in future speed work, but that was not the quality acceptance criterion. No claim that equal CPU or unlimited search would show the same result. No weights, queue ratios or thresholds were tuned to these samples.

Per the predeclared condition, independent-seed validation was not triggered because neither exploratory comparison improved wins. This rejects this E1 policy as the next default, not every possible portfolio strategy. There were160 measured benchmark trajectories over40 distinct mode/seed combinations, plus2 forced-choice continuations. All runs exited0.

## Observational A/B/C probes (complete)

Command: `node scripts/experiments/smart-hint-fallback-probes.mjs`. All probes use fresh planning without previousHint, reconstructed actual prefix knowledge/context, and verified plan replay. The result source is pinned2d1ecfc with observation-only instrumentation. JSON summary: [probes](T028-fallback-probes-summary.json); raw `.cache/T028-fallback-probes.json` has full observations and trajectories.

| Position | States per search | Best-First | FIFO |
| --- | ---: | --- | --- |
| A | 512 | REVEAL25 | INCONCLUSIVE |
| A | 1024 | REVEAL25 | INCONCLUSIVE |
| A | 2048 | REVEAL25 | INCONCLUSIVE |
| C | 512 | INCONCLUSIVE | FOUNDATION11 |
| C | 1024 | INCONCLUSIVE | FOUNDATION11 |
| C | 2048 | FOUNDATION13 | FOUNDATION11 |

At512, A expands to depth32/10 and C to24/11. First accepted/raw goal in A Best-First is depth29 (shortened to25), in C FIFO depth11. All unsuccessful A/C probes have rawGoalsBeforeDedup=0: no evidence that U/history/dedup hid a generated goal in those failed searches. C's successful FIFO does skip some raw goals by dedup; this is not the cause of the other search's zero. Fallback preserves A and rescues C at B512 and B1024; at B2048 primary already finds C's13-command plan, so FIFO does not run and cannot replace it with the11-command alternative.

B at10000: both orders expand only to depth6, with zero raw goals, zero U/history rejection and no raw goals lost by dedup. Primary/FIFO search applyMove counts129704/127196, max queued entries7950/7194. In this observed portion the state budget binds before the32-command horizon; this does not prove that a goal exists within or beyond that horizon. Fallback(10000+10000) remains INCONCLUSIVE, not a negative proof.

## Independent B reachability (complete, unresolved)

The same probe command runs an independent FIFO with full mechanical equality, no SmartHint score/depth limit, information boundaries and a100000 retained-state cap. It drains accepted states even after missing new states set truncated. It returns UNKNOWN after100000 expansions/1335381 applyMove transitions; no goal found. Existing independent F04 also returns UNKNOWN at the same retained-state ceiling (39972 expansions before its immediate budget exit). These are two bounded unknown results, not equivalent amounts of work or a proof of no progress.

An assert-based self-check extracted the exact reachable() function from the probe source and compared28 small full-deck fixtures (both modes/visible versus remembered knowledge) to independent F04. All statuses match without truncation;16 positive cases reconstruct and legally replay a nonempty goal plan. This exercises the independent oracle's positive-path reconstruction as well as negative exhaustion.

## Counterfactual first choice (complete)

The saved histories confirm commonPrefix=52. Replay exactly that prefix and force either of the first different commands: baseline waste→tableau2 or FIFO draw. Thereafter use the SAME unchanged Best-First(10000), depth32, max500 total commands, fresh planning after the forced choice, then normal commitment continuation. Every card observation is accumulated from the initial deal along the actual branch; B's later48-card knowledge is NOT assigned retroactively to the prefix. Forced prefix commands are replay input, not claimed strategic recommendations; post-prefix plans are engine-verified.

Both branches WON in184 total commands. Their exact histories are saved in the probe summary. Thus neither first move by itself made this deal unwinnable; the test does not identify the later cause of FIFO's stopped B position or prove that all later choices are equally good. No further queue/weight tuning or hybrid-ratio search was performed.

## Delivery and limits

Full unit/build checks above are fresh for this implementation. Only an unused import was removed afterwards; no search behavior changed. All main benchmark and probe plan replays, full-deck invariants and expansion-bound assertions passed. Final source/diff review checked wrapper final versus temporary statuses, per-run versus total ceilings, abort boundaries, commitment forwarding, immutable work snapshots, observation anchors, raw-goal counter scope and forced-prefix knowledge. No parallel reviewer, per project prohibition.

No E2E, physical-device, mobile latency or new seed42 trial: application/runtime is unchanged and this is a Node-only experiment. Timing columns are not speed evidence. Independent B reachability is still UNKNOWN. Check `git diff --check`, staged diff and raw summary hashes before results commit. Keep REVIEW until explicit acceptance; do not start another experiment automatically. Resume from this report and saved outcomes only on coordinator assignment. No push/publication.
