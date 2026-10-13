# T028 — continuation regressions, 2026-10-13

Coordinator assigned only two reproduction tests after reviewing the current
uncommitted changes relative to 15cc31d. No algorithm repair is assigned yet.
Added tests/unit/smart-hints-continuation.test.js; production files and existing
dirty tests/fixtures/spec/profile script are preserved unchanged.

## Results

`npm test -- tests/unit/smart-hints-continuation.test.js`

Exit 1; two tests failed, zero passed. Both failures are the expected assertions,
not setup errors. Preconditions passed. Full suite/build/E2E were not run.

1. `remembered continuation must reject a tail whose only action undoes its goal`
   — real full-deck board checked by assertInvariants. Move 2♠–A♥ onto 3♦,
   then A♥ into its foundation. Initial replay is locally accepted/UNPROVEN.
   After the first move, replay of the tail is DEAD_END, accepted=false and
   nonReturningActions=0. Expected INCONCLUSIVE with an empty plan; received
   FOUND with the rejected foundation command. CONFIRMED at the generator API.
   The previousHint is explicitly constructed; this test does not prove that
   the UI would select that original two-command plan in a normal search.
2. `remembered continuation must respect an already aborted signal`
   — real H02 fixture, legal foundation-return/reveal plan. Without cancellation
   its tail is an accepted FOUND continuation. Abort before generator.next():
   expected done=true and CANCELLED/cancelled=true/reason=CANCELLED/truncated=true;
   received FINAL/truncated=false. CONFIRMED.

No mocks, hidden rank-based choices or new dependencies. Tests assert required
behavior and intentionally stay RED until repairs are explicitly assigned.
This checkpoint contains the test and project tracking only; it does not
include the uncommitted continuation implementation that reproduces the bugs.

## Resume

On coordinator assignment, repair the rejected-tail guard and cancellation
ordering, rerun these two tests, then agree remaining verification scope.
Parent T028 stays IN_PROGRESS, not DONE. No push is assigned for this checkpoint.

## Assigned repairs delivered — 2026-10-13

Coordinator subsequently assigned implementation. Both regressions now pass;
see [repair report](T028-continuation-fix.md) for changes and current checks.
The RED evidence above is historical, not the current result.
