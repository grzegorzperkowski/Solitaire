# T028 — p95 / shorter plans checkpoint, 2026-10-13

Status: IN_PROGRESS; checkpoint, not acceptance. Coordinator assigned the supplied
step1/step2 optimizations, then limited verification: "bez testów na razie",
revised to "albo jakieś bardzo podstawowe - jest już późno idę spać".

Start: master at 7a36c30. T014/T027 dependencies have recorded acceptance.
Unrelated untracked solitaire-stan-2284836135-draw1-114.json stays untouched.

## Scope / ledger

Only src/engine/smart-hints.js, a focused estimate/order check and project records.
Reuse rank/color, engine commands, existing replay/evaluation, exact state keys,
positive U and graph rejection. No duplicate smart-hints_2.js, runtime dependency,
UI/save/F04/rules changes, subagents, worktree, branch or push.

1. Precompute unknown rank/color counts once. Estimate without per-call arrays,
   sets or callbacks, preserving foundation > king > placement precedence.
   The supplied fast code double-counts foundation/placement and foundation/king
   overlaps; subtract the lower-weight contribution for each unknown foundation ID.
2. Share each candidate's verification object, use a field-based first-move key;
   INFORMATION length-first, FOUNDATION F/B/length-first.
3. Shorten only the selected final candidate, cooperatively between replay attempts.
   Preserve target H/F/I, positive U, no extra B, boundary and graph-proof safety.
4. Very basic focused checks, build/diff; checkpoint commit with deferred gates.

Ruling: no claim of <0.1ms or lower p95. Replay costs must be measured later;
yield between attempts so the controller can cancel without losing its verified
selected plan. For a non-boundary end, preserve the exact mechanical terminal key
and require shortened ancestors to be a subset of the original proof exclusions.
Cost if wrong: conservative shortening can leave removable steps, but it cannot
silently replace a graph-verified endpoint with an unchecked board.

## Changes delivered

- Unknown rank/color counts are computed once in a Uint8Array(28). The estimator
  uses one bit mask across seven columns and four foundations, no per-call arrays,
  Sets or callback closures, and preserves the old single-benefit precedence.
- Candidate storage/best selection share one verification object; alternative
  keys use command fields instead of JSON.stringify.
- INFORMATION compares length/estimate/B/U/order; FOUNDATION compares F/B/length/
  U/order. REVEAL, queue ordering, weights, limits and graph machinery stay intact.
- The final-only greedy shortener removes legal redundant commands before the
  last goal, preserves H/F/I, positive U, no extra B and information boundaries.
  Non-boundary end key and ancestor-subset constraints retain the existing proof.
  It yields per attempt and reports attempts/removed commands; no claimed 0.1ms.
- Updated REQUIREMENTS, ARCHITECTURE, TEST_PLAN and T028-spec. No app/UI or save
  changes needed: optional diagnostics already flow through the existing export.

## Actual basic checks

| Command | Result |
| --- | --- |
| `npm test -- tests/unit/smart-hints-optimization.test.js` (RED) | Exit 1: information plan had unnecessary waste transfer (W1/L2 instead of W0/L1). Two estimate precedence checks already passed, characterizing semantics to preserve. |
| `npm test -- tests/unit/smart-hints-optimization.test.js tests/unit/smart-hints-proposal.test.js tests/unit/smart-hints-continuation.test.js tests/unit/smart-hints-goal-endpoint.test.js tests/unit/smart-hints-graph.test.js` | Exit 0: 35 tests in 5 files, 2.24 s. Includes both real foundation advances, continuation/abort and graph safeguards. |
| `npm test -- tests/unit/smart-hints-optimization.test.js` (final) | Exit 0: 4 tests, 514 ms including startup; adds equal-F direct-foundation case. 36 distinct focused tests passed across the two GREEN runs. |
| `npm run build` | Exit 0, Vite production build, 92 ms. |
| `git diff --check` | Exit 0, only expected LF→CRLF notice. Staged check and manual diff inspection before commit. |

Author reviewed mask width/deduplication, benefit precedence, empty unknown pool,
exact command key fields, verification sharing and shortener proof preservation.
This was sequential author review, not independent review or full validation.

## Deferred checks / resume

Intentionally did not run the full unit suite, any E2E, full-deck BFS audit,
200-game benchmark, paired speed measurements or physical touch/Safari checks.
Shortener deletion/cancellation/performance property coverage remains incomplete.
No p50/p95 numbers, lower-p95 claim or strategic improvement claim for this
iteration; last iteration's measurements are historical, not current evidence.

Checkpoint commit message: `T028: checkpoint allocation-free hints and final plan shortening`.
Keep IN_PROGRESS, not REVIEW/DONE: required broad checks remain deferred. Resume
only when the coordinator assigns it, then cover shortening safety/actual deletion,
full unit/E2E and paired 7a36c30/54d6c7e benchmarks. Measure shortener cost separately
and any candidate-order effects; do not promise lower p95 from the code alone.
Preserve unrelated cursor-114 JSON and prior v3 deferred scope. No push/publication.
