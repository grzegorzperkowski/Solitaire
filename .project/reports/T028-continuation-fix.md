# T028 — continuation repair, 2026-10-13

Coordinator explicitly assigned implementation of the two confirmed regressions
after reproduction commit 31634b9. Scope: rejected-tail guard and pre-aborted
signal handling. Preserve previous accepted repairs and existing dirty work;
full checks and the remaining v3 audit stay deferred.

## Changes

- `continuePlan` now requires `analysis.verification.accepted` as well as a
  successful replay and a goal. A rejected tail falls back to normal search.
- An already aborted signal skips continuation and reaches the existing
  cancelled-result path. WON still has its previous precedence. No duplicate
  cancellation payload or new abstraction.

Two conditions changed in the existing working implementation. Relative to
HEAD, the commit also contains the previously uncommitted continuation helper
and `previousHint` parameter required by these repairs. Only those relevant
hunks are staged; pending key/queue optimizations, nonPositiveGoals, depth-30
defaults, controller/spec/script edits and existing dirty tests/fixtures stay
uncommitted and unchanged. The committed depth default remains 12.

## Verification

- Before repair: `npm test -- tests/unit/smart-hints-continuation.test.js`
  — exit 1, both expected assertion failures repeated.
- After repair: `npm test -- tests/unit/smart-hints-continuation.test.js tests/unit/smart-hints-graph.test.js tests/unit/smart-hints-app.test.js`
  — exit 0, 33 tests passed in three files.
- `npm test -- tests/unit/smart-hints.test.js -t "remembered plan|external AbortSignal|a reveal that costs|H15"`
  — exit 0, 22 passed and 11 skipped. H15 matches the acceptance describe title,
  so this includes the acceptance group as well as the requested filters.
- Read-only `node --input-type=module` assertions loaded the staged planner
  and HEAD engine dependencies as data URLs, replayed both real-board scenarios
  and checked rejected-tail fallback, valid continuation and cancelled fields
  — exit 0. This checks the commit independently of pending engine optimizations.
- `git diff --cached --check` — passed before commit.

Both confirmed reproductions are now GREEN. Full suite/build/E2E, cursor-73
benchmark and broader hidden-value properties were not rerun. No new push
assigned. Ready for coordinator review of this limited follow-up; not DONE.
The first regression is a constructed previousHint at the planner API, not proof
that the UI selects that original plan. Continuation replay remains local
verification; this repair does not add a new complete continuation graph search.
