# Klondike Solitaire — implementation plan

Status: design only. All checkboxes below describe future work. Completing these documents does not start implementation.

**Goal:** ship a Polish, mobile-first Klondike game meeting [REQUIREMENTS.md](REQUIREMENTS.md).

**Architecture:** pure immutable engine, command timeline with derived snapshots, one session/controller, DOM/SVG view and native browser input/storage. Read [ARCHITECTURE.md](ARCHITECTURE.md) before changing contracts.

**Stack:** vanilla JavaScript ES modules, HTML, CSS, SVG; Vite, Vitest, @vitest/coverage-v8 and @playwright/test as development tools.

**Execution:** the human coordinator explicitly assigns one task at a time from [.project/TASKS.md](.project/TASKS.md). Follow AGENTS.md: one implementation agent, current branch, no parallel work, worktrees, agent branches or automated orchestration. Submit each task for REVIEW, commit its report and stop. Only coordinator approval makes it DONE; that approval does not assign another task. Each phase ends with the listed evidence; unresolved acceptance failures block its dependents. [TEST_PLAN.md](TEST_PLAN.md) defines test cases and release gates.

## Global constraints

- Polish player-facing text; portrait width 320–430 CSS px first, seven columns without horizontal scrolling.
- Zero initial runtime dependencies; no React, backend, solver or database.
- Engine imports no DOM, clock, storage or ambient randomness. Every input path uses validated commands.
- Minimum face-up overlap 24 px, corner rank 14 px, primary control target 44×44 px; vertical scrolling handles excess height.
- Preserve zoom, keyboard play, reduced motion and safe areas from the first UI phase.
- No phase may report an unexecuted test as passing. Real-device gates stay outstanding until evidence exists.

## Dependencies and delivery strategy

`P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10`.

Optional `P7a` depends on P7 and is included in P10 checks only if selected. P8/P9 can proceed without it. The sequence intentionally validates touch usability before expensive artwork polish. Within each phase, take the smallest checklist item, add the relevant failing test for new nontrivial behavior, implement it, then run the named check. Keep commits focused when implementation begins.

The checklists below describe milestone scope, not permission to execute an entire phase. Concrete reviewable tasks and their acceptance criteria are in `.project/tasks/`; TASKS.md is the status ledger. Intermediate tasks may deliver a subset of a phase's APIs/tests, but the phase exit remains unchanged. Defer scripts/tests that depend on later files until their owning task; do not add passing placeholders.

| Milestone | Concrete tasks |
| --- | --- |
| P1 | T001 toolchain; T002 deterministic deal and initial unit CI |
| P2 | T003 transfers/invariants; T004 stock/recycle/enumeration; T005 engine simulations |
| P3 | T006 session/history/statistics |
| P4 | T007 persistence; T008 clock/browser lifecycle/tab ownership |
| P5 | T009 responsive board; T010 tap/keyboard; T011 game dialogs |
| P6 | T012 pointer drag; T013 physical-device feasibility gate |
| P7 | T014 hints; T015 completed game flow/statistics |
| P7a | T016 optional safe completion, only if explicitly selected |
| P8 | T017 artwork/animation; T018 accessibility/performance acceptance |
| P9 | T019 offline build; T020 update/install lifecycle; T021 Pages preparation |
| P10 | T022 release verification/handoff; T023 publication smoke test only when explicitly requested |

T000 records workflow preparation, outside the implementation milestones. T023 is a separate authorization gate for the existing P10 publication step; without it, the result is a verified deployable build, not a published release.

## Review focus

| Failure-prone condition | Owning phase / explicit check |
| --- | --- |
| Draw 3 partial batch followed by played waste cards and recycling | P2: exact-order fixtures for 1/2 remaining stock cards and multiple cycles. |
| Finger starts on selected card, then Safari cancels or orientation changes | P6: cancellation fixtures plus physical iPhone check, no move and no stuck capture. |
| Undo after win, save, reload and win again | P3/P4: exactly one award per attempt, cursor/history restored. |
| Two tabs or denied/quota-exhausted storage | P4: exclusive ownership/conflict behavior and last valid save preserved. |
| Worker update while offline/dragging/unsaved | P9: interrupted-install and update-acceptance scenarios preserve play/save. |

## P1 — reproducible toolchain and deterministic deal

**Depends on:** completed design and a user instruction to implement.

**Files:** package.json, package-lock.json, vite.config.js, index.html, src/main.js, src/engine/cards.js, tests/unit/cards.test.js, tests/fixtures/deals.json, README.md, .github/workflows/ci.yml. Update .gitignore only for actual new generated artifacts.

**Contract:** `createGame(options) → GameState`; card identity and shuffle version 1 as specified in ARCHITECTURE.md. Initially expose createGame through cards.js; game.js may re-export it when rules are added.

- [ ] Select compatible stable tools and Node LTS from current documentation, pin through the lockfile; create `dev`, `build`, `preview`, `test`, `test:coverage`, `test:simulation` scripts with Vitest in Node.
- [ ] Define the public state shape and add deck/deal/seed validation tests, including frozen golden outputs for 0, 1, 42 and maximum seed. Verify expected fixtures independently before accepting them.
- [ ] Implement card identity, fixed PRNG, Fisher–Yates and row-wise deal. Add only a minimal Polish shell for build verification.
- [ ] Run `npm ci`, `npm test -- tests/unit/cards.test.js`, `npm run build`; CI repeats the same locked install, unit checks and build.

**Exit:** all four seed fixtures match byte-for-byte; every deal has 28 tableau/24 stock/7 face-up cards; invalid seeds/modes reject; a clean install and production build pass. No game UI claimed yet.

## P2 — all rules and engine invariants

**Depends on:** P1.

**Files:** src/engine/game.js, tests/unit/game.test.js, tests/fixtures/boards.js, tests/unit/simulation.test.js, scripts/run-simulation.mjs; finish the simulation script entry in package.json.

**Contract:** validateMove, applyMove, getLegalMoves, assertInvariants and isWon exactly as defined in ARCHITECTURE.md; immutable GameState in/out.

- [ ] Add full-deck fixtures and rule tests T01–T08, freezing inputs and checking rejected commands leave state unchanged.
- [ ] Implement legal tableau suffixes, single-card foundations/waste, foundation returns, atomic reveal, draw and recycle with the documented array convention.
- [ ] Implement complete legal-action enumeration and win detection; compare enumeration with exhaustive candidate validation on fixture boards.
- [ ] Add deterministic seeded simulation with failure traces. The small Node runner validates ci/release profile, passes it through an environment variable to the Vitest simulation file, and propagates failures. Run `npm test -- tests/unit/game.test.js` and `npm run test:simulation -- --profile=ci` using the profile contract in TEST_PLAN.md.

**Exit:** every legal/illegal rule case passes; 1,000 seeds per mode × up to 300 commands preserve invariants; all enumeration entries validate; 51 foundation cards is not a win. No solver or win-rate claim.

## P3 — session, Undo/Redo and accounting

**Depends on:** P2.

**Files:** src/session.js, tests/unit/session.test.js.

**Contract:** `createSession(options, attemptId, statistics) → Session`; `execute(session, command) → Result<Session>`; `undo(session) → Session`; `redo(session) → Session`. Session contains timeline/cursor, derived snapshots, started/winRecorded flags, elapsedMs and per-mode statistics. Clock increments arrive from app.js later; session does not read time.

- [ ] Test T09/T10/T14: move+reveal as one undo unit, Draw 3/recycle round trips, no-op boundaries, rejected action preserving redo, valid branch truncation.
- [ ] Implement timeline/snapshot navigation and first-action/first-win accounting. Derive displayed moves from cursor.
- [ ] Test Restart/new attempt semantics and full undo-to-deal/redo-to-final simulation replay; clock values remain independent of history.
- [ ] Run `npm test -- tests/unit/session.test.js` and the CI simulation profile including history operations.

**Exit:** every accepted command round-trips through Undo/Redo; reload-independent session accounting cannot award the same attempt twice; restarting resets board/time/history and retains aggregates.

## P4 — versioned save/restore and lifecycle clock

**Depends on:** P3.

**Files:** src/persistence.js, src/app.js, tests/unit/persistence.test.js, tests/unit/session.test.js, playwright.config.js, tests/e2e/storage.spec.js. Add `test:e2e` script and browser installation/checks to CI.

**Contracts:** serializeSession/restoreSession as in architecture; `loadSave(storage) → Result`; `saveSession(storage, session, metadata) → Result`; app controller owns monotonic clock and writer lock. Browser storage and clock are small injected test seams, not a new adapter framework.

- [ ] Test T11–T14 malformed/schema/size/action-limit/illegal-history cases and permission/quota failures; retain exact original saved bytes after failure.
- [ ] Implement bounded schema parsing, complete timeline replay, envelope writes, writer ownership and fallback revision conflicts.
- [ ] Wire first-action timing, dialog/pause/visibility lifecycle, five-second checkpoints and paused restore. Test with a controllable clock and real page visibility/reload scenarios.
- [ ] Run `npm test -- tests/unit/persistence.test.js tests/unit/session.test.js` and `npm run test:e2e -- tests/e2e/storage.spec.js`.

**Exit:** board, future redo tail, flags/stats and elapsed time round-trip; corrupted/unknown saves survive untouched; two tabs cannot silently take ownership when locks are available; fallback limitation is visible; denied storage still allows temporary play. Timer excludes hidden time and never rewinds with Undo.

## P5 — responsive playable board and tap/keyboard path

**Depends on:** P4.

**Files:** src/ui/render.js, src/ui/layout.js, src/ui/cards.js, src/ui/input.js, src/styles.css, src/app.js, src/main.js, tests/unit/layout.test.js, tests/e2e/play.spec.js, tests/e2e/layout.spec.js, tests/e2e/accessibility.spec.js.

**Contracts:** `mountGame(root, controller) → cleanup`; `render(state, uiState) → void`; `computeLayout({width,height,columnCounts}) → geometry`; `bindInput(root, controller) → cleanup`. Controller dispatches commands through session.execute; tests address semantic labels, not private CSS selectors.

- [ ] Create simple legible SVG faces/backs and stable pile/card nodes; add minimum-width/long-column layout assertions first.
- [ ] Implement seven-column sizing, two-slot waste fan, shared tableau scroller, upper piles, bottom toolbar, safe areas and overflow scroll controls.
- [ ] Implement tap selection/destination rules, stock activation, roving keyboard focus, announcements, disabled controls and Undo/Redo. Build Polish New Game/Restart/Pause/Help dialogs with focus management.
- [ ] Verify T15/T17/T18/T19 at all core viewport sizes using `npm test -- tests/unit/layout.test.js` and `npm run test:e2e -- tests/e2e/play.spec.js tests/e2e/layout.spec.js tests/e2e/accessibility.spec.js`.

**Exit:** a fixture game is fully playable by taps and keyboard; all seven columns fit 320 px; long sequences stay selectable with ≥24 px bands; top/bottom controls remain reachable in short landscape; hidden card identities do not appear in DOM/accessibility output; no horizontal overflow.

## P6 — touch/mouse drag and mobile feasibility gate

**Depends on:** P5.

**Files:** src/ui/input.js, src/ui/layout.js, src/ui/render.js, src/styles.css, tests/e2e/input.spec.js, tests/e2e/layout.spec.js.

**Contract:** gesture state is UI-only; every successful release emits exactly one existing command. Cancellation emits none.

- [ ] Add T16 cases for mouse drag, selected-touch sequence, threshold, outside/illegal drop, pointercancel, lost capture, extra pointers and resize/hide/Escape.
- [ ] Implement pointer capture, one rAF overlay update, legal-target hit testing, click suppression and edge autoscroll. Preserve native scroll on unselected cards and pinch zoom.
- [ ] Verify mouse drags and touch taps in Playwright, supplemented by synthetic pointer lifecycle tests clearly labelled as such.
- [ ] Test on physical Android Chrome and iOS Safari: 20 legal/illegal drags, long-column scrolling, zoom and rotation. Record device/OS/browser and observations in release evidence; fix the gesture model before moving to polish if it fails.

**Exit:** zero duplicate moves, accidental page scrolls during a drag or stuck overlays in the fixture suite; no state change on cancellation; lower column and foundation destinations reachable; physical-device path confirmed. Run `npm run test:e2e -- tests/e2e/input.spec.js tests/e2e/layout.spec.js` and retain the manual record.

## P7 — hints and finished game flow

**Depends on:** P6.

**Files:** src/engine/hints.js, src/app.js, src/ui/render.js, tests/unit/hints.test.js, tests/e2e/play.spec.js.

**Contract:** `rankHints(state) → Command[]`; all returned entries come from getLegalMoves. UI owns hint cycling; session owns statistics.

- [ ] Test T20 priorities, deterministic tie order, no hidden-rank dependence and empty legal-action lists.
- [ ] Implement hints, Polish feedback and preference/statistics screens. Complete seed entry/copy, mode-change confirmation and New Game/Restart cancellation flows.
- [ ] Add near-win fixture flow through win dialog, Undo, save/reload and win again; verify exactly one award and correctly presented practice state.
- [ ] Run `npm test -- tests/unit/hints.test.js tests/unit/session.test.js` and `npm run test:e2e -- tests/e2e/play.spec.js`.

**Exit:** all mandatory F01–F11/F13 flows exist and pass their fixtures; hints never issue illegal moves or claim a guaranteed result; statistics and timing match the chosen rules.

### T027 — assigned P7 follow-up

Implement reachable-progress search, lifetime card knowledge with schema-v1
migration to v2, cancellable UI analysis and Polish notices according to
[the approved specification](.project/tasks/T027-spec.md). Task gates and exact
FX/UT/E2E evidence live in [T027](.project/tasks/T027.md) and its report.
This extends F04/T20; it does not select optional automatic completion.

### T028 — planned SmartHint follow-up

Task/specification preparation only; implementation is not assigned.
[T028](.project/tasks/T028.md) depends on accepted T014/T027 and adds bounded
best-first goal planning, cancellation, Polish explanation and H01–H15 plus
baseline measurements. Broader weight calibration requires a separate assignment.
No change to formal NO_PROGRESS, persistence, or optional completion scope.

## P7a — optional safe completion

**Depends on:** P7; coordinator selected T016 on 2026-10-21. Implementation REVIEW; acceptance pending.

**Files:** src/engine/hints.js, src/app.js, src/ui/render.js, src/ui/input.js, src/ui/smart-hints.js, src/styles.css, tests/unit/completion.test.js, tests/fixtures/completion-save.json, tests/e2e/completion.spec.js.

**Contract:** `getCompletionPlan(state) → Command[] | null`; no mutation, only foundation commands, at most 52. Empty stock and fully visible tableau required; nonempty waste permitted after winning preflight. No separate cancel button.

- [x] Test T21 eligibility/rejection and preflight replay; implement only if the copy reaches a win.
- [x] Execute through normal session commands; stop at the next committed move on Undo/hide/pause/dialog/ownership loss, and disable competing move input during the batch.
- [x] Verify each transfer remains individually undoable, statistics award once, and reduced motion changes presentation only.

**Exit:** `npm test -- tests/unit/hints.test.js` and completion E2E cases pass, with no offer outside F12. If omitted, omit its control entirely and mark the optional tests “not in scope”.

## P8 — artwork, accessibility and performance polish

**Depends on:** P7.

**Files:** src/assets/cards.svg, src/ui/cards.js, src/styles.css, src/ui/render.js; add THIRD_PARTY_NOTICES.md only if needed; tests/e2e/accessibility.spec.js and visual fixtures.

- [ ] Replace simple artwork with readable original/licensed pips, distinct J/Q/K portraits and patterned backs; inspect all 52 cards at small and large sizes.
- [ ] Add restrained movement/flip/invalid-drop/win feedback, honoring reduced motion; verify rapid input cannot duplicate commits or lose focus.
- [ ] Run contrast, screen-reader, 200% text/zoom, device-pixel-ratio and screenshot checks; verify every player-facing message is Polish.
- [ ] Measure T22 budgets on the recorded device/profile. Optimize only observed misses; run `npm run build`, full `npm run test:e2e` and record asset sizes/traces.

**Exit:** U07/U08 and N01–N06 have evidence; all J/Q/K are distinct, minimum indices remain readable, asset license status resolved, no unresolved visual overlap or inaccessible operation.

## P9 — installable offline build and Pages preparation

**Depends on:** P8.

**Files:** public/manifest.webmanifest, public/icons/*, public/sw.js, scripts/build-sw.mjs, src/main.js, src/app.js, vite.config.js, tests/e2e/offline.spec.js, .github/workflows/ci.yml, README.md. Extend build script with worker asset injection.

- [ ] Test generated precache enumeration/base URLs and T23 interrupted install, offline reload and v1→v2 update cases.
- [ ] Implement native worker/manifest, readiness and installation help, waiting-update prompt and saved safe reload. Register worker only for the production path under test/release, avoiding stale development caches.
- [ ] Verify builds served at `/` and `/Solitaire/`; cache scope and cleanup must not affect a sibling application on the same origin.
- [ ] Prepare Pages artifact workflow gated on the tested commit; select actual repository base at deployment time. Run `npm run build` and `npm run test:e2e -- tests/e2e/offline.spec.js` on generated output.

**Exit:** a successfully cached game opens/restarts/plays/saves offline; partial cache/update failure preserves the old game; base-scoped icons/manifest/worker load; installation works on tested supported devices. Workflow is ready; publishing is a separate explicitly requested action.

## P10 — release verification and handoff

**Depends on:** P9 and every mandatory gate above; P7a only if included.

**Files:** tests/unit/simulation.test.js, tests/e2e/*, README.md, docs/release-check.md (created during implementation), CI configuration if needed.

- [ ] Run clean `npm ci`, `npm test`, `npm run test:coverage`, `npm run test:simulation -- --profile=release`, `npm run build`, `npm run test:e2e`.
- [ ] Complete the physical-device/browser matrix and exploratory checklist in TEST_PLAN.md. Record exact seed/action traces for any failures, fix and rerun affected checks.
- [ ] Record requirement-to-test coverage, tool/browser versions, performance/size results, storage/offline limitations and optional-feature scope. Require zero unresolved release-blocking defects.
- [ ] When deployment is requested, publish the tested artifact and smoke-test its actual HTTPS URL/subpath, restore and offline behavior. Otherwise hand off the deployable artifact and instructions.

**Exit:** all mandatory requirements have recorded evidence, 10,000 seeds per mode × up to 1,000 steps pass release simulation, required browser/device checks pass, and no solver/solvability claim is made. A blocked physical-device check is reported as incomplete production verification, not replaced by emulation.
