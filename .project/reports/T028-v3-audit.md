# T028 v3 — checkpoint, 2026-10-12

Coordinator requested skipping full tests and then **commit and push only**.
This is a checkpoint, not completion or coordinator acceptance. T028 remains
IN_PROGRESS; resume the remaining audit only on explicit assignment.

## Findings and implemented changes

1. **CONFIRMED — ancestor cycles.** Synthetic S→A→C→A→D accepted an
   unnecessary detour as FUTURE_GOAL_REACHABLE. Replay now records all plan
   ancestors; graph continuation excludes them. Regression failed before the
   change and passes afterward; dead ends remain rejected.
2. **CONFIRMED — cutoff publication.** Normal yields were private, but the
   time cutoff published the last temporary yield. Controller now aborts via
   AbortSignal and resumes the generator to obtain its cancellation result.
   Results explicitly carry TEMPORARY, FINAL or CANCELLED phase. Regression
   failed against the prior controller and passes with the change. Stale board
   and request callbacks: **NOT REPRODUCED**, existing guards pass the added test.
3. **CONFIRMED — shared verification budget loses quality.** Rechecking two
   dead components consumed six reads and let an UNPROVEN FOUND displace valid
   EXPLORATION. Cache only complete dead-continuation proofs; reuse requires a
   higher/equal F threshold and a superset of ancestor exclusions. Regression
   now returns EXPLORATION, untruncated, with four reads and two cached proofs.
   Separate regressions protect differing ancestors and lower F thresholds.
4. **NOT COMPLETED — hidden-value property matrix.** Existing hidden-value
   tests remain; the broader simultaneous permutation regression requested in
   v3 was not added before the commit-only instruction. No new evidence claimed.
5. **NOT REPRODUCED — shorter second history.** Synthetic long and short paths
   to X confirm expandedCost=2, boundary=false, complete=true, the expected
   child edge and zero unexpanded states. Different information-boundary
   histories were not exhaustively checked in this checkpoint.
6. **Measured optimization.** Profiling attributed 73.2% of cursor-73 elapsed
   time to getLegalMoves. Enumeration now validates each source once and checks
   destinations without allocating frozen successor boards. Allocation
   regression: 23 freezes before, zero afterward. Existing independent legal
   move enumeration tests pass. applyMove/validateMove still validate execution.

Only two optimizations: reuse proven dead continuations and cheaper legal-move
enumeration. No search limits, scoring weights, save format or game rules changed.

## Timing evidence

Uninstrumented runs, same fixtures and options, three repetitions per case:

| Case | Median before | Median after | Expanded before/after | Result |
| --- | ---: | ---: | ---: | --- |
| cursor 73 | 29,535 ms | 11,922 ms | 88,896 / 88,896 | NO_STRATEGIC_PROGRESS, truncated=false |
| H09 | 124 ms | 65 ms | 300 / 300 | Same FOUND/REVEAL plan, score 294, truncated=true |

Cursor 73 still has 88,896 unique states, zero stale entries, zero unresolved
cutoffs and zero goals. Previously recorded independent BFS agrees; BFS was
not rerun for v3. This is not proof that the deal is unwinnable.

Instrumented cursor-73 own times (before → after): getLegalMoves
23,651 → 4,316 ms; progressStateKey 4,732 → 4,308 ms; applyMove
2,307 → 2,107 ms; evaluateSequence excluding child calls 252 → 209 ms.
Final graph phase is ~0.04 ms because this fixture has no candidates. H09 local
verifyEndState takes ~0.3 ms, and final graph phase ~0.3 ms; their inclusive
times overlap and must not be summed. No large candidate-verification timing
claim is made. Instrumentation overhead and machine load affect timings.

Raw evidence: T028-v3-{benchmark,profile}-{before,after}.jsonl in this directory.
Historical measurements load matching historical engine helpers, not current
optimized helpers. Script asserts deterministic repeat results and unchanged
input; cursor-73 status/counts are asserted too.

## Checks actually run

- Focused regressions were observed RED before each confirmed repair.
- `npm test -- tests/unit/legal-moves-cost.test.js tests/unit/game.test.js tests/unit/smart-hints-app.test.js tests/unit/smart-hints-graph.test.js`
  — 81 tests passed in four files.
- Prior-controller reproduction via Vitest filtering `time cutoff asks|temporary yields|cancelled callback`
  — cutoff regression failed, normal-yield and stale-callback tests passed;
  current controller restored afterward.
- `node scripts/profile-smart-hints.mjs fc7b658 benchmark`
  and `node scripts/profile-smart-hints.mjs fc7b658 profile` — completed.
- `node scripts/profile-smart-hints.mjs working benchmark`
  and `node scripts/profile-smart-hints.mjs working profile` — completed.

Full suite, build, E2E, new broad hidden-value permutations and independent BFS
rerun were skipped following the coordinator's late instruction. No physical
device latency check. The new shared-engine enumeration needs those remaining
checks before acceptance. Preserve unrelated CSS/accessibility edits and root
cursor-114 JSON; they are excluded from this checkpoint.

## Resume

On coordinator assignment: add the requested hidden-value permutation matrix,
cover remaining information-boundary histories, document the new result phase
and ancestor/proof contracts in T028-spec/module header, run agreed remaining
checks, and update task status for review. Do not treat push as acceptance.
