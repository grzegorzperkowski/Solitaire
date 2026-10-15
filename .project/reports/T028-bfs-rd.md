# T028 — FIFO/BFS R&D, 2026-10-15

REVIEW. Coordinator explicitly resumed experimental implementation and whole-game measurement: "teraz robimy badania ... żeby sprawdzić czy jest lepszy trzeba to zaimplementować i sprawdzić". Experiment complete; no coordinator acceptance inferred.

Base: 2d1ecfc on master. T014/T027 dependencies remain accepted. Both unrelated untracked diagnostic JSON files must remain untouched. Sequential execution; no agents, branches, worktrees or push.

Question: does FIFO expansion improve whole-game outcomes compared with current best-first expansion while retaining the exact scoring, information boundaries, epoch reconstruction, commitment certificate, final shortening and graph accounting?

Probe: load the pinned baseline source and derive an experimental module by replacing only its priority queue with a FIFO. Keep production modules unchanged. Verify real-board goals against the independent BFS, legal replay, hidden permutations, continuation and cancellation. Compare paired Draw 1/3 games with deterministic state budgets; retain commands, outcomes and source hashes. No speed or shortest-plan claim.

Plan: (1) focused RED check; (2) implement isolated experiment and GREEN checks; (3) paired whole-game comparison at explicit budgets; (4) record results and limitations, review/stage explicit paths and commit; set REVIEW, never DONE without acceptance.

## Implementation and checks

- `scripts/experiments/smart-hint-bfs.mjs` reads the pinned planner with `git show`, replaces only its nested queue, and imports both modules in memory. FIFO releases popped references and asserts nondecreasing expansion depth. There is no production option or duplicated rules/scoring implementation.
- Existing `playDeal` executes only the first recommendation command, updates actual knowledge and history, checks every advertised plan through engine replay/invariants and tracks board+knowledge returns. Both variants use the same active-prefix context and original commitment certificates. `previous` in output means 2d1ecfc; `current` means experimental FIFO.
- First `npm test -- tests/unit/smart-hints-bfs-experiment.test.js`: RED, missing experimental module, exit1. No algorithm existed yet.
- Same command after implementation: 30 passed, exit0, 604ms. Covers 28 complete small graphs against the independent oracle, needed foundation pull, consistently renamed unknown cards/context, commitment, cancellation and unchanged root.
- `npm test` after strengthening the fixture assertions (exact expansion count and transformed history context): 367 tests / 28 files passed, exit0, 21.24s. This overlapped the second deterministic-work benchmark; timing fields are not speed evidence.

## Whole-game measurements

Seeds200–219, Draw1 and Draw3: 40 paired deals per budget, 500-command cap, depth32, no clock cutoff. Equal numeric state limits retain the baseline contract (both retained-state and expansion bounds); they do not imply equal transition counts, memory, or elapsed time. Larger-budget repeats reuse the same deals and are not independent extra samples. No tuning on these seeds.

### 512 states (complete)

Command: `node scripts/experiments/smart-hint-bfs.mjs --budget=states --count=20 --start-seed=200 --max-steps=500 --max-states=512 --max-depth=32 --output=.cache/T028-bfs-512.json`

| Metric | Baseline | FIFO/BFS |
| --- | ---: | ---: |
| Draw1 wins / 20 | 6 | 1 |
| Draw3 wins / 20 | 3 | 2 |
| Total wins / 40 | 9 | 3 |
| INCONCLUSIVE | 23 | 29 |
| NO_STRATEGIC_PROGRESS | 8 | 8 |
| Tableau reveals | 554 | 454 |
| Commands | 3242 | 2291 |
| Same board+knowledge returns | 2 | 0 |

Paired: both win2, baseline-only7, FIFO-only1, neither30. No move-limit terminations or preparation-only recommendations. Fewer FIFO commands/returns are not a quality improvement: many trajectories stop earlier. Returns in baseline occurred in seed202/Draw1; purposeful intermediate returns are allowed by contract, so this count alone is not evidence of an idle loop. The previous report's zero returns applied to its own seeds100–119, not this new sample.

### 2048 states (complete)

Command: `node scripts/experiments/smart-hint-bfs.mjs --budget=states --count=20 --start-seed=200 --max-steps=500 --max-states=2048 --max-depth=32 --output=.cache/T028-bfs-2048.json`

| Metric | Baseline | FIFO/BFS |
| --- | ---: | ---: |
| Draw1 wins / 20 | 9 | 2 |
| Draw3 wins / 20 | 2 | 1 |
| Total wins / 40 | 11 | 3 |
| INCONCLUSIVE | 16 | 27 |
| NO_STRATEGIC_PROGRESS | 13 | 10 |
| Tableau reveals | 546 | 498 |
| Commands | 3409 | 2662 |
| Same board+knowledge returns | 0 | 0 |

Paired: both win3, baseline-only8, FIFO-only0, neither29. No move-limit terminations or preparation-only recommendations. Increasing budget changes chosen goals and trajectories, so whole-game wins need not be monotonic in budget (including baseline Draw3, 3 wins at512 versus2 at2048).

### 10000-state follow-up

Command: `node scripts/experiments/smart-hint-bfs.mjs --budget=states --count=5 --start-seed=200 --max-steps=500 --max-states=10000 --max-depth=32 --output=.cache/T028-bfs-10000.json`

Exploratory subset seeds200–204, both modes (10 paired deals), same depth32/500-command cap and no clock cutoff. This subset was chosen as the first five consecutive seeds, not selected by outcome. It is not a new independent validation sample. All runs completed, exit0.

| Metric | Baseline | FIFO/BFS |
| --- | ---: | ---: |
| Draw1 wins / 5 | 3 | 1 |
| Draw3 wins / 5 | 1 | 0 |
| Total wins / 10 | 4 | 1 |
| INCONCLUSIVE | 1 | 4 |
| NO_STRATEGIC_PROGRESS | 5 | 5 |
| Tableau reveals | 135 | 125 |
| Commands | 950 | 823 |
| Same board+knowledge returns | 2 | 0 |

Paired: both win1, baseline-only3, FIFO-only0, neither6. No move-limit terminations or preparation-only recommendations. FIFO recovered seed203/Draw1 at this budget (152 commands versus baseline148) but still lost seed202/Draw1 and seed204/Draw1 that baseline won. Baseline also won seed201/Draw3, where FIFO stopped. The depth limit is still32: this tests the application's numeric state ceiling without its 100ms time ceiling, not unlimited BFS.

## Finding

Do not promote FIFO as the default: it produced fewer wins at both 40-deal budgets and in the 10-deal high-budget follow-up. This is an implemented, measured negative experiment, not a theoretical rejection of BFS. It does not establish that every BFS-based strategy is worse; only the isolated FIFO replacement with the current scoring/history policy and measured limits was tested.

There were 90 paired runs (180 whole-game trajectories) over 40 distinct mode/seed combinations, including repeated budgets. Same-board returns alone are insufficient as a quality metric. A larger search can choose a different, worse goal even though it can reach more states. Goal selection and finite-budget exploration remain separate questions for a future coordinator-assigned experiment; no change to U, history policy or information model was bundled here.

## Evidence and scope

Tracked summaries contain all individual outcomes, paired counts, Node version, options and hashes of both planner sources: [512](T028-bfs-512-summary.json), [2048](T028-bfs-2048-summary.json), [10000](T028-bfs-10000-summary.json). Full command histories and per-hint checks are in ignored `.cache/T028-bfs-{512,2048,10000}.json`; summaries include their normalized SHA256. `previous`/`current` retain the existing comparison helper's naming and mean baseline/FIFO here. All three runners exited0, including legal-replay, invariants, no-preparation-only and expansion-limit assertions.

Production `src/` has no diff. `npm run build`: exit0, 35 modules, JS108.10kB/gzip32.94. Build overlapped deterministic-work measurement; no speed claim. No new dependencies, schema, F04, input or UI changes. The in-memory pinned planner imports engine dependencies from the checked-out tree; reproduce at this experiment's commit, not an arbitrary future engine revision.

Both untracked files retain report hashes: cursor114 `e37b9b83a9954eca408926ba99b136ac1242ff1addc1d8a9400f03e63c4d22cf`; seed42/cursor89 `5952ddae309d75b37b4b1316753c0e2095f97c4fd2d670e81006a0007dce5ecb`.

E2E and physical-device checks are not rerun for this isolated Node experiment. Full production UI evidence remains in the previous delivery, not claimed fresh here. No improvement, shortest-plan, mobile latency, universal win-rate or zero-return guarantee. No automatic promotion into the application.

## Delivery / resume

Implementation, focused tests and the 512/2048 results are checkpointed at `6176477`. Follow-up commit records the 10000 results and REVIEW status. Sequential author review checked the source replacement boundaries, monotonic FIFO depth, unchanged production imports, outcome labels, paired seed coverage, budgets, raw hashes and explicit staging. No agents, new branches, push or publication.

`git diff --check` and `git diff --cached --check` passed before checkpoint commit; final checks are repeated before the results commit. No behavior changed after the 367-test/build runs. No fresh seed42 game, E2E, physical-device or speed calibration was run in this experiment. The earlier 137-command result belongs to its earlier 100ms profile and is not claimed for these fixed-state runs.

For resumption, reproduce using the commands above at this experiment commit and read the saved paired outcomes. All planned measurements are finished. Keep T028 REVIEW until explicit coordinator acceptance (date, approver, accepted commit); do not auto-start a successor. The experiment remains available in Git without changing the application's planner.
