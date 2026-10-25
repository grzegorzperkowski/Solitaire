# Pasjans Klondike

Polish, mobile-first Klondike with a deterministic, DOM-free engine. Supports Draw 1/3, tap/mouse/keyboard play, touch dragging, Undo/Redo, local save/restore, statistics, strategic hints and victory animations. The session controller owns history, time and single-writer protection; the UI submits validated engine commands. Current task states and remaining PWA/release work are recorded in [.project/TASKS.md](.project/TASKS.md).

For a fresh AI session start with [AGENTS.md](AGENTS.md), [.project/STATUS.md](.project/STATUS.md) and [.project/HANDOFF.md](.project/HANDOFF.md). Work only on the explicitly assigned task.

## Requirements and versions

- Validated environment: Node.js **22.22.0**, npm **10.9.4**.
- Supported Node ranges: `^22.13.0 || ^24.0.0 || >=26.0.0`, satisfying Vite, Vitest 5 and ESLint 10. Use a maintained LTS release within this range.
- Installed versions: Vite **8.3.4**, Vitest **5.0.3**, `@vitest/coverage-v8` **5.0.3**, `@playwright/test` **1.64.0**. package-lock.json records the exact dependency graph.
- No runtime dependencies. Unit tests run in Node; browser E2E tests use Playwright and Chromium.
- Static analysis uses pinned development dependencies: ESLint **10.5.0**, `@eslint/js` **10.0.1** and `globals` **17.13.0**.

Requirements checked against the published npm package `engines`/peer dependencies and current official docs via Context7: [Vite setup](https://vite.dev/guide/), [Vitest setup](https://vitest.dev/guide/). Node 22.22.0 satisfies the selected versions; the coverage provider matches Vitest exactly.

## Run locally

```sh
npm ci
npm start
```

Use the local URL printed by Vite. `npm run dev` also works. To preview production output:

```sh
npm run build
npm run preview
```

Both servers bind to the local machine by default. Stop them with Ctrl+C. Preview is for local verification, not a production hosting server.

## Checks

```sh
npm run lint
npm test
npm run test:coverage
npm run test:simulation -- --profile=ci
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm test` runs `vitest run` once (non-watch): engine rules, sessions/history, persistence, application lifecycle, hints, layout calculations and tooling. Golden deals in `tests/fixtures/deals.json` cover seeds 0, 1, 42 and 4294967295; they were generated independently of the engine shuffle. Unit tests run without a DOM emulator.

`npm run lint` checks source, scripts, tests and root configuration files using ESLint's recommended rules plus selected correctness checks. Unused declarations and undefined names fail the check; complexity above 25 and nesting beyond five levels remain informational warnings. Browser/Node globals are scoped by file group; test files include both because browser callbacks live alongside Node test code. Deliberately omitted fields in object-rest expressions are allowed. Frozen planner baselines, generated files and historical report scripts are outside the check. No automatic fixes run.

`npm run test:e2e` starts the production preview at port 5173 and a development harness server at 5186. Rebuild after source changes before running E2E: the main tests exercise `dist`, not live source. Tests cover keyboard/focus, touch/drag, layout, dialogs, storage/ownership and hints. Native Chromium touch-drag coverage supplements synthetic handler checks; physical Safari/Android and assistive-technology checks remain part of the manual test plan. Linux CI installs Chromium with `npx playwright install --with-deps chromium`.

`npm run test:simulation -- --profile=ci` plays seeds 0–999 in Draw 1 and Draw 3, plus seed 4294967295 in both modes, for at most 300 steps. It checks board invariants, input immutability, enumerated moves and rejected commands. The action selector is a separate SplitMix32 generator. Undo, redo and save/restore are not part of this profile. A passing run does not mean the deals are winnable.

`--profile=release` selects seeds 0–9999 in each mode, plus the same maximum seed, for at most 1,000 steps. That full run belongs to the release gate, not to ordinary checks. Any other profile exits nonzero.

GitHub Actions (`.github/workflows/ci.yml`) runs the locked install, lint, unit tests, CI simulation, production build and full Chromium E2E on Node 22. After all checks pass on master, the test job uploads its tested `dist` and a dependent job deploys that artifact to Pages. Pull requests and other branches run checks without publishing. Manual dispatch on master follows the same test gate. A local test command does not run the hosted workflow.

## Static hosting compatibility

Vite `base` is `./`, keeping built asset references relative for repository-subdirectory hosting. Pages deployment is included in the CI workflow. For an explicit path smoke test:

```sh
npm run build -- --base=/Solitaire/
npm run preview -- --base=/Solitaire/
```

Open the printed local URL under `/Solitaire/`. Run plain `npm run build` afterwards to restore the default relative-base artifact. Standalone manifest/service-worker and offline-installation acceptance remain tracked in T019–T020; Playground integration is tracked separately in T026. See [Vite public base path](https://vite.dev/guide/build.html#public-base-path).

Build output (`dist/`), dependencies (`node_modules/`) and coverage reports (`coverage/`) are already ignored by .gitignore. Keep package-lock.json committed.

## SmartHint comparison

Run a quick comparison of the previous SmartHint, the current production planner
and the original `rankHints` reference:

```sh
npm run benchmark:hints
```

The default quick profile uses seeds 0–2 in Draw 1/3, up to 30 moves, 128 states,
depth 32, a 20 ms active-time budget and 12 identical sampled positions. It runs
both fixed-state and fixed-time comparisons. This is a fast regression signal,
not evidence of a general strategy advantage. The initial local run took about
6 seconds; actual time depends on hardware and changes to the planner.

For the 100-seed-per-mode comparison with the game's current budgets:

```sh
npm run benchmark:hints -- --profile=full --budget=time --output=.cache/hints-full-time.json
```

Full uses up to 100 moves, 10,000 states, depth 32, 100 ms active computation per
hint and 100 identical sampled positions. `--budget=states` removes the clock
cutoff for deterministic search results; `--budget=both` runs both experiments.
Full fixed-state searches can take substantially longer than the time-limited
run. Use quick for routine changes and full when deciding whether to accept one.

Both versions are available locally: frozen
[`scripts/baselines/smart-hints-90fba4f.js`](scripts/baselines/smart-hints-90fba4f.js)
and current [`src/engine/smart-hints.js`](src/engine/smart-hints.js). No checkout,
branch switching, external service or new dependency is required. Provenance is
documented in [scripts/baselines/README.md](scripts/baselines/README.md).

The console shows results separately for each draw mode and budget. JSON includes
source hashes, environment/budgets, per-deal command histories and per-call
metrics, both versions' results on identical positions, and the positions
themselves. Start/middle/end positions are sampled from both SmartHint trajectories,
deduplicated by board and knowledge; the seed 2284836135/cursor 114 diagnostic
is always included. Reports default to `.cache/hints-quick.json` or
`.cache/hints-full.json`. They are replaced atomically only after a successful
run; copy a report or set a different `--output` to keep earlier measurements.

Metrics include wins, reveals, returns to the same board (also counted separately
when knowledge is unchanged), moves, unresolved stops, median/p95 computation
time and visited states, truncation, and plans that only prepare without a reveal,
net foundation advance or new information. Independent legal replay evaluates
plan effects and stops at information boundaries; illegal plans abort the run.
Scores from the two planners do not determine the winner. MOVE_LIMIT and
INCONCLUSIVE are unresolved, never proof of a lost deal. Paired win outcomes and
a Wilson 95% interval for the current share of discordant wins are reported;
an absent interval means neither version won a deal that the other did not.

All options use `--name=value`. Supported overrides: `--count`, `--start-seed`,
`--max-steps`, `--max-states`, `--max-depth`, `--active-ms`, `--positions`,
`--profile=quick|full`, `--budget=states|time|both`, and `--output`.
For a separate evaluation set, use e.g. `--start-seed=10000`. Do not tune against
that set and then call it held-out. The time experiment excludes scheduler waits,
uses alternating execution order and a small untimed warmup, and does not
replace physical phone/Safari latency measurements. Timing varies across runs;
use identical-position timing to assess speed rather than comparing different
playthrough lengths alone.

`medianPairedSpeedup` is the median of previous/current time ratios on identical
positions: above 1 means current was faster, below 1 means previous was faster.
It is a measurement from one run, not a statistical guarantee. Both revisions use
the current shared move engine; hashes identify those shared modules as well.

Three-current-version integration comparison: `node scripts/benchmark-hint-integration.mjs --positions-only`
for 105 frozen boards; `--full` adds seeds0–99 in both modes at 100 ms/10000 states/depth32.
Baselines are commits 2447cff and 5320616 with only imports relocated to the common
engine. Cooperative planners receive AbortSignal and remembered plan tails, matching
the controller; legacy planners are closed at cutoff. See
[the integration report](.project/reports/T028-integration.md).

PWA and normal browser tabs use independent saves (including statistics and preferences) and independent writer locks. The mode is selected at page startup from standalone display mode. Legacy shared saves are not imported; both modes start fresh after this change. Multiple windows in the same mode still share one save and allow only one writer.

If another window holds the writer lock, the read-only game retries when it returns to the foreground or via Menu → Ponów dostęp do zapisu. Once access is available, it reloads the latest saved game before play resumes.
