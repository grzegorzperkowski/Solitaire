# T028 — integration of both local histories, 2026-10-14

Status: REVIEW. Coordinator approved combining the two copies and selected
`C:\Sources\MyProjets\Solitaire` as the canonical workspace: "tak zróbmy,
będziemy pracować w katalogu C:\Sources\MyProjets\Solitaire". Earlier explicit
"commit all, push" authorization remains applicable after validation.

Start: master at 2447cff; other local master at 5320616; common ancestor bdad66c.
T014/T027 dependencies have recorded acceptance. The unrelated untracked
solitaire-stan-2284836135-draw1-114.json must remain untouched and unstaged.
No parallel agents, branches, worktrees, rule/save changes or new dependencies.

Approved scope: retain the advanced app/engine/UI features and unpublished
checkpoint from this workspace; integrate the repaired planner, regression
tests and benchmark evidence from the other history. Preserve both histories.

## Execution and checks

- [x] Fetch both histories, merge on master without automatic commit, resolve
  documentation/caller conflicts while retaining app cancellation, remembered
  plan continuation, legal-move optimization and victory/mobile features.
- [x] Run imported regressions RED on this workspace's previous planner.
  Integrate hidden-safe I, strategic foundation acceptance, preserved partial
  recommendations and scoring changes. Keep strict search budgets, exact keys,
  knowledge-complement estimate and diagnostic alternatives where compatible.
- [x] Validate cancellation/continuation/shortening and exhaustion against the
  updated contract; keep separate F04 BFS and its evidence unchanged.
- [x] Run focused/full unit checks, build and all Chromium E2E. Compare the two
  latest planners and integrated planner on frozen identical positions with
  100-ms active budgets, and paired deals using the same engine/knowledge.
- [x] Update requirements/architecture/test/task records with actual results,
  limitations and reproducible commands; inspect explicit staging. Deliver with
  a T028 merge commit and the authorized normal push. Leave REVIEW pending acceptance of the
  integrated revision; preserve the other checkout and unrelated JSON.

## Initial verified discrepancies

Read-only real-engine probes on the two heads: h10's identical reveal scores
116/116 with unknown/remembered hidden top in 5320616, but 136/116 in 2447cff.
The valid full-deck fixture with one terminal foundation move returns FOUND in
5320616 and INCONCLUSIVE in 2447cff. These establish two regressions, not overall
quality or speed superiority. Historical benchmarks used different baselines.

## Delivered integration and review

The merge preserves both parents (2447cff and 5320616), including the unpublished
allocation-free estimator/shortener checkpoint. Retained victory effects,
mobile gesture fixes, optimized legal moves, F04 BFS, controller AbortSignal,
remembered plan tails, hidden-safe complement estimate and up to five boundary
alternatives. App changes only its default depth from 30 to 32. Rules, schema,
history, save data and runtime dependencies remain unchanged.

Planner changes: I excludes tableau reveals; W is only a queue reward; incidental
foundation prefixes cannot pad reveal utility; known navigation costs 0.5 in final
utility; achieved positive foundation progress needs no second future goal.
Removed the final continuation-proof pass, its candidate resets/empty yields and
1-ply simulations. Graph metadata remains solely for sound exhaustion/cut
bookkeeping; zero verificationReads/cachedDeadEnds retain diagnostic compatibility.
Cancellation preserves the best accepted plan, including a shortened winner.
Continuation now honors explicit maxDepth, which the previous implementation
could bypass. Candidate verification is shared and reports horizon zero.

Queue navigation retains a 4-command cost (U +65W -3.5N). Using the discounted
final utility directly as queue priority first caused the saved cursor73 audit
to hit 100000 expansions instead of completing; restoring the queue's navigation
cost restores its exact 88896-state exhaustion without raising the test budget.
Default production limits are 10000 states, 32 commands, 100 ms/4 ms batches.

Updated old tests for the deliberately replaced future-goal rejection policy
and removed tests of its deleted proof cache. Preserved graph cut/stale/count and
independent real-engine BFS coverage; added achieved-goal/cancel-at-every-yield
checks. BFS's I counter now excludes tableau H (F04 implementation unchanged).
The imported h10 result-equality check now compares utility/components/plan:
the retained knowledge-complement estimate legitimately changes with the supplied
memory, while a hidden tableau card cannot add 20 to its reveal utility. Hidden
permutation and remembered-value masking regressions remain in place.

Sequential author review per AGENTS.md: reviewed callers, staged semantic diff,
information masking, goal endpoint, root knowledge/key normalization, strict
budgets, controller cancellation/continuation and shortener replay. This is not
independent review. Non-boundary shortening remains conservative and can leave
removable commands; no global shortest-plan or global cycle-freedom claim.

## Commands and actual results

| Command | Result |
| --- | --- |
| `git fetch origin`; `git fetch C:/Sources/Solitaire master` | Success; imported 5320616 into FETCH_HEAD, remote remained 7a36c30. |
| `git merge --no-commit --no-ff FETCH_HEAD` | Expected 11 content conflicts; resolved explicitly, retaining advanced app/docs and incoming benchmark infrastructure. No branch/worktree/reset/force push. |
| `npm test -- tests/unit/smart-hints-regressions.test.js` before integration | RED: 5 failures/16; reproduced hidden-memory I, single/two terminal foundation goals, dropped yield and waste-assisted reveal I. |
| Initial combined full `npm test` | 309 passed/21 failed: replaced policy/score expectations, old BFS I counter and the cursor73 queue-priority concern described above. |
| Continuation zero-depth focused check | RED: cached tail returned a move despite maxDepth=0; fixed before broad GREEN. |
| `npm test -- tests/unit/benchmark-hints.test.js tests/unit/smart-hints-shortening.test.js` | 17 passed, 742 ms. Includes cooperative benchmark cancellation/tail forwarding, exhaustive-negative recording, actual removal on frozen Draw3/seed84 and cancellation after removal. |
| `npm test` final | 325 passed in 26 files, 20.07 s. Includes saved cursor73 exact exhaustion, hidden permutations, full-deck invariants and history/ownership/victory cases. |
| `npm run build` | Passed: 35 modules, 173 ms; JS 106.48 kB/gzip 32.42, CSS 17.47 kB/gzip 4.34. Relative base `./` unchanged. |
| `npm run test:e2e` | All 98 Chromium checks passed, 22.6 s; includes terminal foundation hint, 320px/gesture/keyboard, save/Undo/Redo and victory behavior. |
| `node .project/reports/T028-repair-position-probe.mjs` after integration | Passed all current-status/replay assertions; measured updated current planner against historical02fb845 on100 frozen boards. Output kept separately as .cache/hints-integration-historical-probe.json; original artifact restored. |
| `node scripts/benchmark-hint-integration.mjs --positions-only` | Passed all assertions on 105 shared frozen boards, both 128-state and 100-ms budgets. |
| `node scripts/benchmark-hint-integration.mjs --full` | Passed: 105 paired boards plus 600 deal runs; all legal replay, goal/boundary, strict-limit and preparation-only assertions. About 1174 s including positions. No tests/other timed experiments ran concurrently. |

One initial source-transformation script stopped at an accidental assertion before
writing any product file; corrected and rerun. An initial log redirection found
no .cache directory; created it before executing the full suite. First graph-test
rewrite had an orphan `else`; corrected before GREEN. The benchmark's first probe
exposed 5320616's telemetry counting a nonexpanded limit-detecting pop; allow its
historical counter +1 only, leaving both baselines' code unchanged. Integrated
and advanced counters remain strictly <= maxStates. These failed attempts are
not represented as successful verification.

## Three-planner measurements

Baselines: advanced **2447cff**, repaired **5320616**, integrated measured source
identified by hashes in [the summary](T028-integration-benchmark-summary.json).
Only baseline relative imports are relocated; all three use the current common
engine, exact knowledge and identical configured budgets. The two cooperative
planners receive AbortSignal and previousHint like the app; legacy 5320616 is
closed on cutoff and ignores remembered tails. Timed deal trajectories differ.
Seeds 0–99, Draw1/3, max100 executed commands, 10000 states/depth32/100ms. These
are development seeds, not a held-out validation set. No claim about mobile time.

| Mode / metric | advanced 2447cff | repaired 5320616 | integrated |
| --- | ---: | ---: | ---: |
| Draw1 reveals | 1460 | 1349 | 1460 |
| Draw1 foundation cards | 1558 | 1432 | 1561 |
| Draw1 repeated board+knowledge | 0 | 0 | 0 |
| Draw1 commands | 8712 | 8801 | 8690 |
| Draw1 INCONCLUSIVE / exhaustive-negative / limit | 40 / 7 / 53 | 38 / 0 / 62 | 40 / 8 / 52 |
| Draw1 median / p95 ms | 0.195 / 100.165 | 100.006 / 100.217 | 0.171 / 100.164 |
| Draw3 reveals | 1123 | 1093 | 1128 |
| Draw3 foundation cards | 1097 | 1039 | 1152 |
| Draw3 repeated board+knowledge | 0 | 10 | 0 |
| Draw3 commands | 5510 | 5785 | 5605 |
| Draw3 INCONCLUSIVE / exhaustive-negative / limit | 43 / 41 / 16 | 83 / 0 / 17 | 30 / 53 / 17 |
| Draw3 median / p95 ms | 0.177 / 100.167 | 100.007 / 100.204 | 0.154 / 100.157 |

Integrated totals: 2588 reveals vs advanced2583 (+5) and repaired2442 (+146);
2713 foundation cards vs advanced2655 (+58) and repaired2471 (+242). Zero
same-knowledge repeats observed, versus repaired10. Board-only returns with
knowledge growth remain 18/61; do not report these as globally absent cycles.
Paired reveal outcomes vs advanced: 3 better, 2 worse, 195 equal; vs repaired:
63 better, 26 worse, 111 equal. All variants won **0** within the 100-command
cap. More reveals/less uncertainty does not establish a higher eventual win rate.

On 105 identical boards at 100ms, all three found 62 strategic/9 exploratory
plans. Advanced/integrated first commands matched on all105. Integrated versus
repaired: 62 shared strategic hits, no baseline-only/integrated-only hits, first
command matching92. At 128 states advanced/integrated each found60 strategic
plans, repaired62; two repaired-only hits remain under that smaller budget.
Median identical-position time: advanced8.65ms, repaired9.42ms, integrated9.43ms;
p95 about100.2ms. No same-board speedup over advanced claimed. Faster whole-game
medians predominantly reflect retained plan continuation (median expanded states
0), not a universal per-search speedup. Lower INCONCLUSIVE partly becomes the
accurate exhaustive-negative status; combined unresolved stops are not wins.

Full raw evidence: `.cache/hints-integration-full.json` (12,805,968 bytes), SHA256
`f5bb28f6bcfdc73241d012e0d3c136305e14521a9357af6e02262c5ccf8fc2c7`.
The tracked summary includes all source/artifact hashes, environment, budgets,
paired counters and aggregates. The driver captures the frozen corpus plus five
latest saved regression positions; no external data is needed for reproduction.
Copied the previous repair's ignored full-time/position raw artifacts from the
other checkout into this canonical .cache after measurement; originals preserved.

## Remaining scope and resume

Ready for coordinator acceptance of the integrated commit: REVIEW, not DONE.
Physical Android/iPhone/Safari, other browser engines, held-out deals and longer
250/500-command win-rate calibration were not run. No production-readiness,
optimality or future-goal safety claim. Historical reports describe their own
sources; previous skips/acceptances are not rewritten as current evidence.
Do not start a successor. Work only in C:\Sources\MyProjets\Solitaire; the other
checkout remains at 5320616 as a preserved copy, not synchronized automatically.
Untracked cursor114 JSON remains untouched/unstaged, SHA256
E37B9B83A9954ECA408926BA99B136AC1242FF1ADDC1D8A9400F03E63C4D22CF.
After reviewing this commit, record explicit acceptance (date, approver, SHA)
before DONE, or resume only the coordinator's requested T028 corrections.
