# Klondike Solitaire — test strategy and acceptance

T028 diagnostic export follow-up: round-trip schema-v2 `save` after Undo in both
draw modes, preserving current board, remembered cards and redo tail; include an
INCONCLUSIVE hint and effective budgets. Export must not write storage or change
the session. Chromium download at 320 px must match the current session/build;
preparation/download failures must show Polish feedback and preserve the save.

Status: planned tests, none executed against an application yet. [REQUIREMENTS.md](REQUIREMENTS.md) is the acceptance contract; [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) assigns implementation ownership.

## 1. Layers and test discipline

- **Vitest, Node:** pure engine, history, statistics, serialization/replay and layout math. Freeze engine inputs; assert exact output plus global invariants. Use small manually constructed full-deck fixtures and deterministic seeds, not an additional property-testing dependency.
- **Playwright:** built application on Chromium, Firefox and WebKit. Test real DOM rendering, focus, input, storage and worker behavior. Each test has a fresh context/save slot unless it explicitly tests recovery.
- **Real devices:** Android Chrome and iOS Safari touch arbitration, safe areas, dynamic browser bars, zoom, scrolling, installation and offline updates. Emulation supplements this evidence.
- **Visual/accessibility/performance:** stable screenshot states, manual screen-reader and contrast checks, production asset measurements and recorded physical-device traces.

Add a regression test before fixing nontrivial behavior. Avoid snapshots as the only proof of a rule. All board fixtures contain exactly 52 cards: small piles under test plus valid supporting piles, never malformed boards accepted for convenience. Invalid-state fixtures are explicitly marked and tested only at validation boundaries.

Use accessible Polish labels to drive E2E. Near-win, long-column and corrupt-save fixtures are seeded via the versioned save schema before app boot. Do not add a production-only backdoor or debug API to manipulate state. For a board that cannot be expressed by a supported persisted action trace, mount the ordinary renderer/controller in a test-only Vite entry excluded from production output; keep its scope to interaction/layout tests, not persistence claims.

## 2. Rule, session and persistence cases

| ID | Cases and required assertions | Requirements |
| --- | --- | --- |
| T01 | Deck has each ID 0–51 once; mapping of all suits/ranks/colors; golden shuffle/deal vectors for 0/1/42/4294967295; same seed/options reproduce; row-wise deal sizes 1–7, 7 visible, 24 stock. Reject fractional, negative, overflow, NaN/Infinity seeds and unsupported modes/versions. | R01–R03, N07 |
| T02 | Tableau accepts red 6 on black 7 and inverse; rejects same color, rank gaps, Ace wrap, self-move, out-of-range index and hidden source. Empty column accepts King only. Invalid command leaves frozen state unchanged. | R04, N07 |
| T03 | Valid 7-black/6-red/5-black suffix moves as a unit; every selected card remains ordered. Reject invalid internal order, partial suffix, hidden crossing or a suffix sent to foundation. Source uncover flips exactly one card atomically; moving an all-visible suffix may empty its column. | R05, R10 |
| T04 | Each fixed foundation accepts its Ace and next same-suit rank only; wrong suit, gaps and non-Ace empty placement reject. Only exposed single card moves out to a legal tableau; foundation-to-foundation rejects. Foundation King completes rank 13. | R06 |
| T05 | Only waste top is playable; buried waste, stock-to-tableau/foundation and any move targeting stock/waste reject. Source/destination shapes and enums are validated. | R07, N08 |
| T06 | Draw 1 removes/pushes exactly one; Draw 3 does so three times in correct order. Remaining stock lengths 1 and 2 draw only remainder. Nonempty waste is retained below new cards. No accidental playable middle card. | R08 |
| T07 | Recycling requires empty stock and nonempty waste; reverses remaining waste once and does not draw. Test multiple complete cycles with zero/one/two played waste cards, partial final batch, and empty/empty no-op. Exact next drawn cards match hand-calculated fixtures. | R09 |
| T08 | 52 correctly placed foundation cards wins; 51 does not. Illegal foundation contents reject at validation. No-move state is not automatically lost; legal draw/recycle prevents a false “no move” hint. | R11 |
| T09 | Undo/Redo each transfer/reveal/draw/recycle; repeated Undo reaches exact deal; repeated Redo reaches exact final state. Empty history bounds are no-ops. New accepted move after Undo erases future; rejected move, hint or selection does not. | F03, F06 |
| T10 | Move count equals cursor; sequence and auto-reveal count once; recycle counts once. Undo/Redo change count correctly. Restart reproduces original board/mode, clears history/time and creates a distinct attempt ID. | F05–F07 |
| T11 | Round-trip seed/versions/mode, cursor, complete redo tail, elapsed time, preferences, flags and stats. Restored commands, including nested from/to in the redo tail, resist mutation and remain replayable after another save. Replay rejects one invalid command anywhere, even beyond cursor. JSON malformed, wrong types, prototype-like keys, extra untrusted strings, invalid cursor, duplicate IDs in derived state and unsupported schema fail safely. | F08/F09, N08 |
| T12 | Reject >1 MiB UTF-8 input and >10,000 commands before excessive replay work; accept boundary values if otherwise valid. Unknown/future schema and corrupt input remain byte-for-byte in storage. Quota/read denial/serialization failure preserve previous save and expose Polish warning; temporary session stays playable. No silent history truncation. | F09, N08 |
| T13 | Fake monotonic clock: first legal action starts time; hidden/dialog/pause periods add zero; cancelled replacement resumes without lost time; reload starts paused; Undo does not rewind. Five-second checkpoint and pagehide settle elapsed time once. Current win pauses clock; Undo resumes practice, without changing the recorded best. | F07/F08 |
| T14 | Per-mode attempts increment only on first accepted action. Win increments once through Undo/Redo, save/reload and re-win. Restart counts as another attempt only when started. Win % uses started attempts, including abandoned/ongoing; zero denominator gives 0%. Equal/better/worse winning records update correctly. Two tabs: lock denies second writer; revision fallback detects conflict, preserves remote save and explains its race limitation. | F10/F11/F13 |

Malformed command fuzz cases must include null, strings, arrays, negative/fractional/oversized indices and unknown pile/type names. Reject safely, without a thrown UI exception. Restore diagnostics must not evaluate saved strings or leak hidden identities into user messages.

## 3. Browser, UX and optional feature cases

T035 mobile Menu regression: at 568×320, 844×390 and 390×400 with mobile/touch emulation and companion enabled, assert Menu's full bounding box is inside the viewport before any automatic scroll; tap its measured center using raw touchscreen coordinates and confirm the menu opens. Native touch must scroll the compact board, not require scrolling the page to find controls. Existing seven-viewport companion checks also assert the footer remains onscreen and below the clipped board/companion region.

T035 slide/width follow-up: sample slide contact/folded shins and accelerated/decelerated travel; verify common phrase endpoints, joint lengths and bounds at scene widths 509/1420/3054. Include slide in random selection and special-action separation. Verify resize observer scene updates and disconnect. Browser tests force the actual slide, verify lowered knees and horizontal travel, resize 1280→320→1920, and check viewport-wide strip geometry without horizontal overflow at all existing viewport cases. Review a rendered knee-slide frame.

T035 extends T11/T12/T16–T19/T22: random selection reaches sway/disco/wave/run/jump, avoids repeats and separates run/jump with dance; sampled geometry has attached, fixed-length limbs, finite bounded coordinates and a shared phrase boundary. Verify one RAF, pause/dialog/hide/read-only/win/reduced-motion cancellation, zero-timestamp/resume timing, bfcache and destroy/remount cleanup. Preference true/false round-trips; v1/v2 missing field defaults off; malformed present values reject and preserve the save. Toggling does not start play or change board/history/statistics. Verify real mouse drag while dancing and cancellation on mode change, keyboard checkbox focus, read-only setting, restore and win→Undo. At all four phone widths, short landscapes and desktop, check strip/card/control separation, seven-column fit, scroll buttons and long-column reachability; add wrapped notices/200% text/reduced motion. Unit coverage: `tests/unit/dancing-companion.test.js`, app and persistence tests; browser coverage: `tests/e2e/dancing-companion.spec.js`. Physical Safari/Android touch, native pinch, performance and battery evidence remain separate from Chromium automation.

| ID | Cases and required assertions | Requirements |
| --- | --- | --- |
| T15 | Tap source/target moves exactly once; on touch, a second tap within 350 ms on the same selected movable card executes the first currently legal destination and repeating after the move recomputes from its new position; deselect/reselect rules; illegal destination feedback; stock draw/recycle controls; disabled Undo/Redo; New Game/Restart/mode-change confirmation accept/cancel; valid/invalid decimal seed and clipboard failure feedback. Check actual card identities/state through save output and visible board. | F01/F03/F05/F06 |
| T16 | Mouse click/drag; touch tap-to-select and direct drag from an unselected face-up card in one gesture; 6 px threshold; native vertical scroll from open tableau space/face-down cards; pinch zoom; outside drop; pointercancel/lost capture; second pointer; release beyond viewport; rapid tap after drag; Escape; hide; resize; autoscroll to lower cards and return to foundation. Each successful gesture creates one move; all cancelled gestures create zero and clean overlays/capture. | F02, U08/U09 |
| T17 | Seven columns stay in bounds at every viewport; no horizontal overflow (`scrollWidth ≤ clientWidth + 1px`); cards have expected aspect ratio and ≥14 px ranks; visible bands ≥24 px; fan stays inside waste area. Long-column fixture, 6 hidden + 13 alternating face-up cards, is reachable without clipped bottom card. Scroll handle/buttons appear only on overflow. Selection survives manual scroll. | U01–U06/U09 |
| T18 | Complete legal play path with keyboard only; arrow focus across empty/occupied piles; stock via Space; Escape; Ctrl/Cmd Undo/Redo except in seed input; dialogs focus/restore; controls labelled in Polish. Screen-reader sample includes reveal and rejects without timer spam. Hidden identities absent from DOM/accessibility markup. | N01/N02 |
| T19 | Normal/reduced motion, 200% text and browser zoom, contrast and focus visibility; safe areas and toolbar changes on device; landscape resize mid-gesture; DPI 1/2/3 screenshots. No required action relies on hover, color or animation. Inspect all four suits' A/10/J/Q/K at 320 px. | U07–U09, N02–N04 |
| T20 | Legal hints retain their stable visible-only ordering. Reachable-progress analysis covers FX01–FX10, UT01–UT24 and E2E01–E2E13 from [.project/tasks/T027-spec.md](.project/tasks/T027-spec.md): multi-step preparation, foundation returns, stock knowledge, Draw 1/3 ordering, neutral cycles, resource exhaustion, hidden permutations, nonmutation, Undo/Redo/reload and stale-result rejection. NO_PROGRESS requires full exhaustion; UNKNOWN never warns; WON wins precedence. | F04 |
| T21 | Optional only: no completion with hidden tableau/nonempty stock or a foundation-only deadlock; nonempty waste allowed only after winning preflight; preflight result consists solely of legal single-card foundation moves and ends won. Undo/pause/dialog/hide/ownership loss/destroy stops execution; individual moves undo; award occurs once; reduced motion does not alter command sequence. | F12 |
| T22 | Measure initial route, bundles, interaction latency and drag frame times with the fixed profile below. Start-up/restore of a near-limit history remains responsive; no per-frame synchronous storage or forced-layout loop. No console errors/unhandled promise rejections during full game flow. | N05/N06/N11 |
| T23 | At root and repository base: asset/manifest/worker URLs are correct; after readiness, disable network and reload/play/restart/save/restore. First-ever offline visit is not claimed supported. Partial install keeps old worker usable. v1→v2 waits during play, updates only after accepted saved safe reload, retains history/stats, does not clear sibling app cache or older live tab assets. Offline update failure leaves a playable version. | N09/N10 |

Playwright's documented touchscreen support is limited to taps; use device contexts for taps, mouse APIs for true mouse drags and explicitly labelled synthetic Pointer Events for handler edge cases. Synthetic touch/pointer dispatch does not demonstrate native browser scroll arbitration. See [Playwright Touchscreen](https://playwright.dev/docs/api/class-touchscreen) and [device emulation](https://playwright.dev/docs/emulation). T16/T19 physical-device evidence remains mandatory.

## 4. Seeded simulations

Use independent deterministic generators for the game seed and the action selector; do not reuse the engine PRNG implementation as the only test oracle. Every failure prints seed, drawCount, rule/shuffle versions, selector seed, step, action history and failed assertion so it can become a compact regression fixture.

Profiles exposed by the planned `npm run test:simulation -- --profile=ci|release` command:

| Profile | Deals | Bound |
| --- | --- | --- |
| CI | Seeds 0–999 in each draw mode, plus max-uint32 fixture | Up to 300 simulation steps per deal |
| Release | Seeds 0–9999 in each mode, plus max-uint32 fixture | Up to 1,000 simulation steps per deal |

A step chooses a legal command, an intentionally invalid command, Undo, Redo or save/restore through a deterministic schedule. Bias some runs toward revealing cards/foundation progress and others toward draws/recycles/returns. Continue across repeat board positions until the bound; unlimited recycling is intentional, not a test hang. Stop early only at win or no legal action when there is also no history navigation to exercise. Assert after each step:

1. All board invariants; input state remains unchanged after a transition.
2. Accepted moves agree with validation; every enumerated move is accepted.
3. Invalid moves preserve board/history/redo/count exactly.
4. Undo/Redo round-trip deep equality and cursor accounting.
5. Periodic serialization/restore preserves current state and future redo branch; replay determinism.
6. Card conservation, foundation order and one-award-per-attempt accounting.

Report actual deals/steps and branch categories exercised. Golden fixtures and explicit rule tests are independent of getLegalMoves so simulation cannot hide a shared enumeration/transition bug. Simulations do not prove every seed is winnable or that hints solve games.

## 5. Viewport and device matrix

| Environment | Required coverage |
| --- | --- |
| Chromium phone contexts | 320×568, 360×640, 390×844, 430×932; touch taps; DPR 1/2/3 across the suite |
| WebKit phone contexts | Same four portrait widths; storage, tap, focus and layout coverage |
| Landscape | 568×320 and 844×390; all columns plus reachable scroll/toolbar/dialog controls |
| Desktop Chromium/Firefox/WebKit | 1280×720 and 1920×1080; mouse/keyboard, constrained height, resize and reduced motion |
| Physical Android | One midrange phone, Chrome current major; repeat critical flows on previous major using a retained device/browser setup when available |
| Physical iPhone | Safari current and previous major OS/browser releases; notch/home indicator, toolbar expansion, pinch, selected-card drag, background/foreground and standalone mode |

Record exact OS/browser/device versions when executing. Desktop Edge receives a smoke test on the release build; desktop Safari receives a real-browser smoke test in addition to Playwright WebKit. If a supported version/device is unavailable, report that gap and keep its release gate open rather than widening the claimed support from emulation alone.

Minimum real-device gesture script per platform: 10 legal transfers (including a sequence and foundation return), 10 invalid/cancelled attempts, three stock recycle cycles in Draw 3, long-column scroll while selected/unselected, rotation during drag, background/foreground, pinch zoom, offline reload, install/launch and waiting update. Board state must remain consistent throughout.

## 6. Performance, accessibility and visual measurements

For startup use the production build on a recorded desktop Chromium machine with a 390×844 mobile viewport, 4× CPU slowdown, cold cache and network shaped to 1.6 Mbps down / 750 Kbps up / 150 ms latency. Record machine/browser/tool versions and five runs; median LCP ≤2.5 s, CLS ≤0.1 each run. Measure JS+CSS gzip ≤100 KiB and total first-load gzip assets ≤500 KiB using the built files, excluding source maps. These are project budgets, not universal device guarantees.

For interaction use a recorded physical midrange Android phone: 30 tap moves and a 10-second drag over legal/illegal targets with autoscroll. Input-to-visible-feedback p95 ≤100 ms, frame interval p95 ≤20 ms, no app-induced >50 ms main-thread tasks in ordinary moves. Profile save/restore separately at the 10,000-command limit and record elapsed time/peak memory; if restore blocks interaction for >500 ms, chunk replay with progress/cancellation while retaining the same pure engine. Do not add a worker without measured need.

Visual baselines use fixed seed, paused timer, fonts loaded, stable browser version and disabled animations. Include initial deal, selected long suffix, Draw 3 fan, near-win, empty columns, narrow landscape, open menu, storage error and reduced motion. Review changed baselines manually; do not automatically accept every screenshot update.

Check contrast from computed colors; test keyboard focus and NVDA or VoiceOver on desktop, VoiceOver on iPhone and TalkBack on Android. A screen reader must be able to identify source, destination, legal feedback and win result. Confirm 200% text/menu reflow and native zoom. Automated label checks do not constitute a full accessibility certification.

## 7. Automation and release gate

Planned scripts: `npm test` (unit), `npm run test:coverage`, `npm run test:simulation -- --profile=ci`, `npm run build`, `npm run test:e2e`; the release profile runs before a release and on a scheduled/manual CI job. Implement profile selection in the simulation runner/script during P2; these commands do not exist during the design phase.

Require ≥95% statements and ≥90% branches for src/engine, src/session.js and src/persistence.js, including all exported files, using the [Vitest V8 coverage provider](https://vitest.dev/guide/coverage.html). Coverage is a gap detector; every rule/edge case above is required even if thresholds pass. UI is evaluated by behavior/accessibility tests rather than a superficial coverage target.

CI installs locked dependencies, runs unit/coverage/CI simulations, builds production output and runs the browser matrix against it. PR CI does not publish. Deployment uses the tested commit/artifact and is followed by a production URL smoke test. Retain failing traces/screenshots and seed histories; retry-only passes require investigation, not silent acceptance.

Release is complete only when all mandatory T01–T20/T22/T23 pass, optional T21 passes if shipped, required real-device checks have evidence, performance/assets meet budgets, all player-facing text is Polish, licenses are resolved, and no known defect can lose cards, silently lose saves, duplicate wins, block an input method or make a supported viewport unusable. Store the evidence in implementation-era docs/release-check.md. This document records criteria, not current test results.

## T027 verification mapping

- `tests/unit/progress.test.js`: FX01–FX10 deck invariants; UT01–16 and
  UT19–24, including three preparatory draws, foundation-only round trips,
  grouping/order discrimination, deduplication and deterministic state budgets.
- `tests/unit/knowledge.test.js`: visible-card lifetime, Draw 1/3, persistence,
  conservative v1 migration and rejection of malformed v2 knowledge.
- `tests/unit/progress-app.test.js`: UT17/18, cancellation, stale-result rejection
  and app result integration. Resource budget tests use deterministic limits.
- `tests/e2e/progress.spec.js`: E2E01–13; deterministic full-deck fixtures use
  `tests/harness/progress.html` on a separate Vite dev server at port 5186.
  The seed 2284836135 replay sets a test-only 5 s analysis budget so browser
  worker contention cannot turn its unbounded wait into a false timeout;
  production retains the 100 ms active-work limit.
  It mounts the ordinary controller/session/renderer with an injected loader;
  it is excluded from the production build. E2E11 uses the production save and
  actual reload. Other existing E2E tests continue against production preview.
- Run `npm test`, `npm run build`, `npm run test:e2e`, plus diff checks.
  Physical Safari/touch measurements remain separate release evidence.

## Planned T20 extension — T028 SmartHint

[T028-spec §7–8](.project/tasks/T028-spec.md) adds H01–H15: multi-step goals,
foundation returns, waste/Draw 3 order, cycles, hidden-information equivalence,
limits, invalidation, Undo/Redo and won state. Add boundary masking, nonmutation,
cancellation, accessible visible explanations and unchanged T027 regressions.
Compare against rankHints on 100 seeds per mode with reproducible quality and
median/p95 timings. These are future acceptance gates, not executed checks.


T028 regression coverage: seeded hidden-stock and buried-waste permutations
must preserve plans/scores; an actual unfinished controller cutoff must mark
truncated=true while retaining its plan. A completed search remains untruncated
when its final batch exceeds the time target. Tests live in smart-hints.test.js
and smart-hints-app.test.js.


T028 hinted gesture regression (T15/T20): seed 22 Draw 1 has a legal tableau
and foundation destination for the same source. After requesting a hint,
mouse double-click and touch double-tap must execute its foundation destination
once, clear highlights/notice, and allow Undo. After Undo, no stale hint may
execute: touch returns to its ordinary tableau destination, mouse to selection.
Covered in tests/e2e/smart-hints.spec.js alongside existing touch/drag regressions.
On mobile emulation, Help and Hint buttons use `touch-action: manipulation` to
avoid double-tap zoom while retaining pinch zoom; covered in accessibility.spec.js.

T030 double-tap zoom regression: the document and native buttons, including
dynamically rendered dialog actions, use `touch-action: manipulation` on mobile.
Face-up cards retain `pinch-zoom` to prevent browser panning from cancelling
drag. Covered in accessibility.spec.js, play.spec.js and input.spec.js, including
the native Chromium CDP touch-drag test; physical pinch/zoom checks remain required.

## T028 strategic-goal regression gates (2026-10-11)

T034 navigation characterization (T18): stock/first-column left edges preserve
focus; Down from the last exposed card retains focus when Undo is disabled,
reaches Undo when enabled, Right toward disabled Redo leaves focus unchanged,
and Up from bottom controls returns to the last exposed card in column four.

T032 focus regression (T18): after a committed draw, focus a tableau card and
wait for the clock label to advance. The original card node must stay connected
and focused. Clock/notices/dialog updates must not rebuild an unchanged board.

T032 ownership regression (T14): a denied lock or newer stored revision rejects
commands before session/history/statistics/preferences change. Read-only clock
stays frozen, board and replacement controls are disabled, menu/export remain
available, and temporary play after unreadable/inaccessible storage still works.
Rejected Web Locks promises must activate and announce fallback without an
unhandled rejection. Late callbacks/rejections after destroy must not regain
ownership or keep a lock held.
Controller teardown/remount (T16): destroying an active input controller removes
its overlay/gesture and all click/drag handlers. Remounting on the same root
must leave one committed action per click and no old native-drag suppression.

T028 p95 checkpoint (2026-10-13): basic `smart-hints-optimization.test.js`
checks one-command information instead of waste padding, equal-F direct
foundation advancement and exclusion of foundation/placement or foundation/king
double counting. Full-suite/E2E/200-game and shortener property/performance
coverage are deferred by the coordinator. Later compare current with 7a36c30
and original 54d6c7e on paired boards and seeds0–99/Draw1+3; report p50/p95,
shortened plans, reveals, repeats and cuts, without assuming a speedup.

T028 proposal adaptation (2026-10-13): `smart-hints-proposal.test.js` checks
direct reveal versus higher-W padding, a reveal versus higher-U foundation
advance, opposite-color placement in the knowledge-complement estimate, an
equal-length reveal tie, exclusion of remembered newly revealed values,
diverse legal boundary alternatives, and strict 0/1/2-command limits.
Keep existing hidden-permutation, graph, BFS, cancellation, continuation,
seed21 anti-loop and A78 single-goal regressions. Use
`node scripts/benchmark-hint-proposal.mjs` for a deterministic paired comparison
against 54d6c7e on seeds 0–99 in both modes, up to 100 commands with remembered
plans, at an explicitly smaller measurement budget (300 states / depth 30).
Disclose this budget and unequal trajectory lengths; it is not mobile calibration
or evidence at the app's 10000-state/100-ms default.

T028 A cursor 78 → B cursor 79 regression: replay
`tests/fixtures/smart-hint-seed2560240634-draw1-78.json`, cancel at 666 expansions
to reproduce the exported A search, and verify a single 4♣ foundation command
with U=36, not the old 17-command U=297 plan. Check a smaller full-deck case
where a waste transfer after the only goal inflated its score, and a positive
case retaining two real foundation advances. Controller integration must show
the single-move explanation before bounded uncertainty on B. Preserve cancellation and strict-budget safeguards; achieved foundation
progress no longer requires a future-goal proof. See `tests/unit/smart-hints-goal-endpoint.test.js`.

Restore fixture solitaire-stan-2284836135-draw1-114.json through save section;
verify 52-card integrity, cursor 114, legal actions and independent F04 outcome.
Waste 2♦ preparation must not be FOUND. Record all H/F/I/W/M/B/L and terminal
board; preserve uncertainty at depth/time/state cutoffs and no unwinnability claim.
For cursor 114, the default depth-limited search stays INCONCLUSIVE/truncated;
with maxDepth 16 and maxStates 10000, the 256-state search returns
NO_STRATEGIC_PROGRESS, null recommendation and empty plan. This status is not
F04 NO_PROGRESS and is permitted only after an untruncated complete search.
Add waste enabling reveal, idle waste, foundation round trip, negative preparation
ending in reveal, alternatives, draw/recycle cycles, sole destination loss,
budget cuts, hidden permutations and end-state verification cases to H01–H15.
Compare previous/new SmartHint on seeds 0–99 Draw 1/3 (up to 100 actions), plus
paired identical positions and budgets: goals, idle suggestions, reveals, repeats,
wins, median/p95 time/states, truncated percentage. Coordinator explicitly
requested skipping tests and benchmark in this revision; these gates remain
unexecuted, not recorded as passed. Existing H05 assertion reflects new contract.


T028 F04 reachability follow-up: waste transfer alone is preparation; net
foundation count and actual newly visible cards classify post-action progress.
Check Draw 1/3 and waste fan exposure, known draws, foundation round trips and
removals, UNKNOWN at retained-state limit, exhaustive NO_PROGRESS with legal
moves, and saved seed 2284836135 at cursor 114. Verify `noLegalMoves=false` and
optional goal while keeping the UI status contract. Benchmark remains separate.

## T028 graph audit regressions (2026-10-12)

`tests/unit/smart-hints-graph.test.js` uses controlled abstract transitions to
force a depth cut later resolved by a shorter path, an actually missing leaf,
root-return detours, genuine continuation to an information boundary, repeated
expansions at maxStates, failed replay, unretained exploration after rejected
foundation goals, cancellation after every yield and at the 64-read graph yield.
Check updated parent completeness/children and never return a rejected plan.
Root/duplicate pending entries alone must not exhaust verification reads.

Remembered tableau boundary scoring: seed0/44 Draw 1 with all card IDs known
must still ignore newly exposed mobility (M=0), keep I=0 and report
INFORMATION_BOUNDARY/horizon=0. Covered by smart-hints.test.js; knowledge does
not permit scoring the revealed card's future moves at that boundary.

`tests/unit/smart-hints-bfs.test.js` compares all goal components and retained
states on 28 full-deck fixtures (1–7, Draw 1/3, visible-only/all remembered).
The independent FIFO oracle in `tests/helpers/smart-hint-bfs.js` uses full
mechanics keys, no score or SmartHint helpers, and stops at every reveal/new
information. Completed SmartHint NO_STRATEGIC_PROGRESS must agree with zero
BFS goals. Verify boundary nodes have no children and completed graphs have
all successor nodes. Remembered tableau reveals remain terminal.

Replay cursor 73 with `node scripts/audit-smart-hints.mjs
tests/fixtures/solitaire-stan-2560240634-draw1-73.json`: accepted c677cad baseline,
current planner and independent BFS, unchanged 250000-state / 100-depth debug
budget. Record status, truncation, expanded/unique/stale states, unresolved
cuts and goal counts. Evidence lives in `.project/reports/T028-graph-audit.md`.

## T029 victory animation extension (T19/T22)

T033 regression: during a genuine win animation, Ctrl/Cmd+Z, Ctrl+Y and
Ctrl/Cmd+Shift+Z leave the won board/history intact in Draw 1 and Draw 3.
Escape/skip still reaches the result; closing it enables normal Undo/practice.

T033 static-analysis gate: `npm run lint` runs after the locked install and
before unit tests in CI. Correctness, undefined-name and unused-declaration
errors fail the gate; complexity/nesting warnings remain informational.
Keep intentional object-rest field omission and immediate planner test doubles
valid; historical baselines/report scripts and generated output are excluded.

Use the development preview to run each effect at desktop and 320px mobile sizes. Verify an intermediate frame, no horizontal scroll, Escape and “Pomiń”, replay replacement, reduced-motion bypass, and final overlay/RAF cleanup. On a near-win fixture, a genuine first win must select one effect while awarding statistics once; the existing result dialog follows skip/completion. Undo/reload/re-win is practice and must not select again. New Game, destroy, page hide, resize and an animation exception must clean up or reach the existing result. Confirm the shuffle bag validates persisted values, cycles all four with no boundary repeat, and maintains this behavior if storage is denied.

## T028 integration gates — 2026-10-14

Run the imported smart-hints-regressions suite: hidden-memory-independent I/U,
one/two terminal foundation goals, retained partial goals, saved cycles, necessary
foundation returns, masked-column safety and long known navigation. Update old
future-goal rejection expectations to horizon-zero achieved-goal acceptance;
keep independent BFS exhaustion, graph cut/stale bookkeeping and F04 unchanged.
smart-hints-shortening covers actual deletion on the frozen Draw3/seed84 position
and cancellation after deletion. Continuation must respect explicit maxDepth.
The benchmark driver covers cooperative cancellation/remembered plans and records
NO_STRATEGIC_PROGRESS separately. Full unit/build/Chromium and reproducible
three-planner comparison: node scripts/benchmark-hint-integration.mjs --full.
105 frozen shared positions have 128-state and 100-ms runs; seeds0–99 in each
mode use 10000 states/depth32/100ms/max100 actions with common engine/knowledge.
Device/Safari checks and held-out longer-game validation remain separate evidence.


## T028 commitment/history regressions — 2026-10-15

- Reversible foundation pulls/returns never reset the epoch; column cycles and
  known stock laps retain visits. Restore reconstructs the active prefix with
  retained knowledge, and Undo excludes redo-tail visits. Restart starts fresh.
- A fresh goal must exceed the epoch's actual foundation high-water mark, reveal
  or learn. Previously attained goals alone give INCONCLUSIVE/HISTORY_RESTRICTED.
  Preparatory paths may pass through visited boards to reach a new endpoint.
- Keep a legal commitment suffix even if local U is negative only with a replayed
  positive original certificate; expose localScoreAccepted/committed separately.
  No context mutation, hidden-value lookahead, stale publication or depth bypass.
- Existing hidden-permutation, graph/BFS exhaustion, shortening and cancellation
  tests remain; winning endpoints outrank partial progress. Full production
  Chromium checks cover existing input/restore/hint flows.
- Pair whole games against fa98db3, not just reveals. Reject trial structural
  weights if quality falls. Final validation uses untouched seeds100–119 in both
  modes at 512 states/depth32 and up to500 commands, recording outcomes/cycles,
  source hashes and legal plan replay. This is bounded development evidence,
  not proof of win rate or phone performance. Seed42 has a separate app-budget run.

## T036 — Small-success animation gates (T09/T19/T22)

Unit tests cover atomic reveal, empty column, Ace, consecutive foundation intensity capped at four, reset by draw, history navigation, initial/unchanged render, new attempt and a fresh branch after Undo. Chromium renderer tests use valid 52-card fixtures at 320px: actual CSS effect/duration/level, empty slot, preserved focus, no horizontal overflow, Undo/Redo suppression and reduced-motion bypass. Existing input/accessibility/completion checks guard interaction and travel. Physical Safari/Android aesthetics and performance remain unverified.

T035 placement regression: at all seven existing viewports, assert the companion strip bottom equals both footer top and Menu button top. Notices (including wrapped/200% text) remain above the strip; keep native scrolling and direct onscreen Menu checks.

T035 compact layout: at 390x670 show the real long hint text beside a 72px companion, with onscreen controls and hidden board build; resize to 390x844 to restore full-width scene/build and larger board, then back to compact. Menu must expose build. Existing seven-viewport geometry expects compact strip at portrait <=599x740, spacious otherwise; keep wrapped 200% text and native touch coverage.

T035 toggle diagnosis: native touchscreen checkbox and label toggle on 390x670/844 and persist on reload. Reader Menu explains read-only state; disabled toggle cannot write. Close writer and reload reader to restore enabled setting change.

T035 pointer regressions: dancing-companion.spec.js checks click/keyboard stop/resume, stationary geometry, captured drag lift, visible parachute, progressive descent and stopped landing; reduced-motion immediate landing; native CDP touch from compact strip, Menu cancellation and resize reset. Existing card drag, geometry, lifecycle/teardown and persistence cases remain required. Inspect parachute screenshot; physical Safari/touch/pinch remains separate evidence.

T035 iPhone hold regression: use exact elementFromPoint hit testing 26 CSS px from the moving figure center in compact layout, then native CDP touch held 650ms, drag upwards and release into parachute descent. This failed with the small SVG target. The HTML button stays at least 64x64 CSS px and avoids SVG-specific interaction; physical iPhone 15 Pro/Safari confirmation is still required.
