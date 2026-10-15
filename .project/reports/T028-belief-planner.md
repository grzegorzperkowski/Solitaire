# T028 — partial external proposal adaptation, 2026-10-15

REVIEW. Coordinator: "dasz radę na podstawie tego co jest zrobić algorytm? jak czegoś brakuje to spróbuj samemu". Base fa98db3, master; T014/T027 accepted. Both untracked diagnostics preserved.

## Design and implementation ledger

1. Add focused RED regressions for session-wide cycles, context reconstruction, information boundaries and new structural candidate ranking.
2. Reuse the exact engine/search/continuation/shortening infrastructure. Add explicit read-only plannerContext reconstructed from the active session snapshot prefix; reset only at actual reveals/new information, never foundation changes. Initial hard-tabu experiment was rejected; final policy permits old intermediate boards and requires a new epoch goal. Policy filtering never proves no progress.
3. Adapt boundary marginalization and structural ranking: prefer useful reveals, conservative low-risk foundation progress, known-card mobility and short plans. Never evaluate a hidden remembered tableau identity. No freezing of foundation cards, no probabilistic win claim.
4. Wire context through controller and benchmark; test Undo/Redo, restart/restore, cancellation, hidden permutations and history-safe shortening.
5. Full unit/build/Chromium and paired whole-game comparison, including seed42; record actual evidence, update contracts and deliver REVIEW with explicit paths staged. No push/successor.

Ruling: no new persisted context or recursive history snapshots. Existing snapshots/commands are sufficient to reconstruct conservative per-epoch history after reload. Retained knowledge from discarded branches is treated as prior memory. New knowledge or fewer hidden tableau cards can clear the epoch; foundation metrics cannot.
Ruling: the supplied weights and safety claims are unvalidated. Adapt their structural features and validate against the existing planner; do not port unsupported guarantees or a second rules engine. Existing API/status/score replay must remain consistent.


## Delivered behavior and decisions

- `createHintContext` rebuilds real visits and the maximum foundation count since
  the last reconstructed information/reveal epoch from active snapshots. Undo
  excludes the redo tail; restore uses existing replayed snapshots. No new save
  field, global singleton, stored belief graph or recursive snapshots.
- A fresh foundation goal must exceed that high-water mark; returning a previously
  pulled card alone is not a new recommendation. Paths through old boards stay
  searchable, and fewer actual returns only breaks otherwise equal priorities.
- Keep an accepted plan's remaining legal commands. If their root-relative U has
  become negative, replay the retained original plan as a certificate before
  retaining the suffix. Expose the actual local score and localScoreAccepted
  separately from committed acceptance. Respect maxDepth and information bounds.
- Give discovered winning endpoints priority. Retain existing score, final
  shortener, graph/exhaustion bookkeeping and unknown-pool marginal estimate.
  Controller and benchmark pass context and preserve commitment origin.
- Discarded the external proposal's depth/safe-foundation weighted ranking after
  paired quality comparisons. No frozen cards, new probabilistic solver, claimed
  high win rate, uniform-posterior proof or runtime dependency was added.

The hard-tabu trial (retained only in .cache) was too restrictive. A second
trial allowed preparatory returns but used the new structural weights; on
seeds0–19/Draw1+3/100ms/max500 commands it won12/40 versus15/40 for fa98db3.
A deterministic calibration on seeds0–9/Draw1+3/512 states/depth32/max400
commands gave weighted6/20 versus baseline7/20 and macro-only7/20. Therefore
none of those weights is shipped. The original new depth-ranking test was
removed with that rejected feature; history/commitment regressions remain.

Conditional argument: during continuous adherence with fixed limits and valid
context, a completed plan reveals, learns, or increases the epoch maximum;
these cannot repeat indefinitely. A still-legal suffix stays committed despite
local rescoring. Intermediate actual returns can be purposeful; there is no
claim of zero board returns, universal solvability or a global shortest plan.
Reload reconstructs history but not an unfinished commitment. After Undo,
acquisition times of retained knowledge are unavailable and reconstruction uses
first observations in the active prefix. Manual deviations/Undo/repeated reloads
are outside the uninterrupted-adherence argument. Bounded search can still stop
on a solvable position.

## Actual commands and evidence

| Command / check | Result |
| --- | --- |
| `npm test -- tests/unit/smart-hints-context.test.js` before production edits | RED, 6/6 failed: missing context export, actual-history return, false recommendation of an old goal and experimental depth ranking. |
| Initial focused context/proposal/continuation/optimization run | 21 passed/1 failed; exposed one-step foundation preference hiding the available win. Corrected winner precedence and removed the inconsistent direct-safe preference. |
| Initial broader focused check | 56 passed/4 failed; the first attempted Python edit failed on Windows default encoding before writing. Re-ran with explicit UTF-8; corrected preference rules. No failed run represented as GREEN. |
| `npm test` initial version | 331 passed, 27 files, 24.28s. Intermediate evidence, not final quality acceptance. |
| `npm test -- tests/unit/smart-hints-context.test.js tests/unit/smart-hints-continuation.test.js tests/unit/smart-hints-app.test.js tests/unit/benchmark-hints.test.js` | 42 passed, 4.97s. |
| `npm test -- tests/unit/smart-hints-context.test.js tests/unit/smart-hints-graph.test.js tests/unit/smart-hints-continuation.test.js` final focus | 21 passed, 492ms. Includes abstract negative-local-score/original-certificate regression and purposeful historical return. |
| `npm test` final | 337 passed, 27 files, 30.63s. Includes existing 88,896-state saved-position/BFS coverage, permutations, continuation, cancellation, shortening, persistence/history and 12 net new tests. |
| `npm run build` | Exit0; 35 modules, 253ms; JS108.10kB/gzip32.94, CSS17.47kB/gzip4.34. Relative base unchanged. |
| `npm run test:e2e` | All98 Chromium checks passed, 24.6s. Production preview plus existing dev harness; includes mobile emulation/input, restore/Undo, hints and victory. |
| `node .cache/compare-seed42.mjs` final | Before/after WON in137 commands,21 reveals,52 foundation cards,0 same-knowledge returns; 100ms/10000 states/depth32/max500 commands, legal replay via existing benchmark. Raw .cache/seed42-belief-comparison.json. |
| `node .project/reports/T028-belief-benchmark.mjs` | Exit0;80 paired deal runs on40 held-out positions (seeds100–119, both modes),512 states/depth32/max500 commands; legal plan replay, no preparation-only recommendation, strict expansion assertions. |
| Read-only restore/current-context/full BFS probe on supplied cursor89 JSON | NO_STRATEGIC_PROGRESS; exactly1872 retained/full BFS states,0 goals,no truncation. File untouched. |
| `git diff --check` / staged check | Initial report blank line and planner trailing space found, removed; final checks recorded before commit. |

No tests overlapped the timed100ms experiments. Unit/build/E2E did overlap
fixed-work validation/calibration, so their reported latency fields are NOT
speed evidence. Context reconstruction lies outside runHint's timer. Final
post-measurement source cleanup removes whitespace only; the summary records
both measured and cleaned planner hashes. No behavioral edits followed the final
full checks.

## Final held-out outcomes

| Metric | Before fa98db3 | Delivered |
| --- | ---: | ---: |
| Draw1 wins / deals | 11/20 | 11/20 |
| Draw3 wins / deals | 4/20 | 4/20 |
| Total commands | 3679 | 3671 |
| Tableau reveals | 580 | 580 |
| Same board+knowledge returns | 0 | 0 |
| Board-only returns with changed knowledge | 13 | 13 |

All40 paired final statuses match, including unresolved/bounded outcomes.
This does not establish higher win rate; seed42 remains137 commands. Seeds100–119
were not used to choose the rejected weights. No 100-seed/depth/budget/mobile
calibration is claimed for this revision.

Tracked sources/individual outcome rows and aggregates:
[T028-belief-benchmark-summary.json](T028-belief-benchmark-summary.json).
Raw .cache/belief-planner-validation.json SHA256
`c279b2e1bf3340baa40b6be925db8c7982f0c4cb431507ce6745b74ee8522dc0`.
Calibration .cache/belief-calibration.json SHA256
`7901bff2afb24089d6d79d7b52a21971023f5a64c675268caaeb722001c9b282`.
Weighted timed trial .cache/belief-weighted-time-comparison.json SHA256
`df58d40e9b43c4e67c68b9ab232063d58b13f95347deef3e22ea611ae6989cf2`.
Final seed42 raw SHA256
`3e6379ca849037807ec48049503725d994878fc03a601b5256540ac86ba0b574`.

Sequential author review covered all changed callers, optional-context behavior,
no hidden-rank reads/new schema, epoch monotonicity, full-graph bookkeeping,
commitment replay/cancellation and status distinction. No independent agent review
(per project prohibition). Physical Android/iPhone/Safari, other browser engines,
continuous reload/commitment persistence and phone latency were not checked.

## Resume / acceptance

Ready for coordinator review, not DONE. Review this task-ID commit and record
explicit date/approver/accepted SHA before acceptance, or assign specific fixes.
No next task, push or publication. Existing unrelated diagnostics remain unstaged:
- cursor114 SHA256 `e37b9b83a9954eca408926ba99b136ac1242ff1addc1d8a9400f03e63c4d22cf`.
- seed42/cursor89 SHA256 `5952ddae309d75b37b4b1316753c0e2095f97c4fd2d670e81006a0007dce5ecb`.
