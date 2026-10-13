# T028 — A cursor 78 → B cursor 79, 2026-10-13

Coordinator reported build 40ca6e6: A suggested moving 4♣ from column 5 to its
foundation as the first of 17 commands; following that move produced bounded
INCONCLUSIVE on B. Assigned diagnosis and repair, preserving earlier fixes.

## Cause and evidence

Exact A reproduction: abort after 666 expansions with the exported budgets
maxStates=10000/maxDepth=30. Before repair it returns FOUND, 17 commands, U=297,
H=0/F=1/I=0/W=5/L=17, matching the export. The first command already supplies
the entire F=1. All remaining 16 commands add no reveal, foundation or information
goal; W rewards five stock/waste transfers. Tail replay from B has goal=null,
F=0/I=0/H=0 and accepted=false. Rejecting continuation remains correct.

The original files restore successfully. Applying A's first command produces
exactly B's full mechanical state, and A/B knowledge arrays match. Lost plan
memory is not the cause. Cancellation exposes an inflated intermediate plan;
it does not invent the trailing preparations.

Independent FIFO full-mechanics BFS on B: 88,896 expanded/unique states, zero
H/F/I goals, truncated=false, ~11,120 ms. After repair full SmartHint with debug
maxStates=250000/maxDepth=100: NO_STRATEGIC_PROGRESS/SEARCH_EXHAUSTED,
truncated=false, 88,896 expanded/unique states, zero goals/stale entries/cutoffs,
551,857 rejected duplicates, ~10,379 ms. These are diagnostic budgets, not new
production limits. Neither result proves that the whole deal is unwinnable.

## Repair

Only register a recommendation when its last edge increases H, F or I versus
its preceding graph node. Continue exploring every allowed preparation to find
later goals. Root-relative goal definitions, weights, limits, deduplication,
graph verification, information boundaries and cancellation remain unchanged.
Thus A's cancellation result becomes the one-command foundation plan, U=36,
and its text is “Ten ruch przenosi kartę do bazy.” B is not forced into FOUND.

New lightweight fixture replays A's 78 commands and preserved knownCards;
private attempt/timing/statistics metadata and raw A/B exports are not committed.
Requirements, architecture, specification and test plan describe the endpoint
rule consistently. No dependency or save schema change.

## Checks

- Before repair, `npm test -- tests/unit/smart-hints-goal-endpoint.test.js`:
  two expected RED assertions (small full-deck example and exact A), one passing
  positive case with two actual foundation advances.
- First combined run after repair: 64 passed, one failed diagnostic-count
  expectation in failed-replay regression. DeadStep is now preparation rather
  than a third candidate; changed the minimum rejected endpoints from 3 to 2.
  Original Safe plan/replay-failure assertions remain. No engine fix weakened.
- Final `npm test -- tests/unit/smart-hints-goal-endpoint.test.js tests/unit/smart-hints-continuation.test.js tests/unit/smart-hints-graph.test.js tests/unit/smart-hints-app.test.js tests/unit/smart-hints-bfs.test.js`:
  66 passed in five files. Includes real controller A→B behavior, single-move
  text, two real advances, previous continuation/cancellation/graph repairs and
  29 independent BFS regressions.
- `npm test -- tests/unit/smart-hints.test.js -t "remembered plan|external AbortSignal|a reveal that costs|H15"`:
  22 passed, 11 skipped; H15 also matches the acceptance describe title.
- Read-only Node replay of original A/B: exact board/knowledge equality and
  fixed A plan/U asserted; full B SmartHint assertions passed. First attempt
  imported UI formatter in plain Node and failed on Vite SVG imports; retried
  engine-only. UI formatting/controller are verified by Vitest above.
- `git diff --check`: passed before checkpoint commit.

Full suite/build/browser E2E and physical-device checks not run; earlier full
test deferral preserved. Ranking changes are scoped to removing post-goal
preparation endpoints; no all-deals optimality claim. REVIEW awaiting acceptance.
Preserve the two pre-staged unrelated seed fixtures and untracked original
A/B/cursor-114 diagnostics. Commit only task-owned paths; no push assigned.
