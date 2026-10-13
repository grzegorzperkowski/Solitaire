# Klondike Solitaire — architecture

Status: proposed implementation design. [REQUIREMENTS.md](REQUIREMENTS.md) owns rules and product behavior; [TEST_PLAN.md](TEST_PLAN.md) owns release evidence. No source code is created in the design phase.

## 1. Structure and alternatives

Use pure engine functions, a small session/controller layer and DOM rendering with inline SVG card artwork. Engine state is authoritative; DOM geometry and gesture state are disposable views. Input, hints and optional completion all submit the same validated commands.

This is preferable to a monolithic DOM-driven implementation, whose history and tests would depend on visual state. Canvas would offer drawing control but require separate hit testing, focus and accessibility infrastructure. A framework/state-management package adds no needed capability for 52 cards.

```text
Pointer / keyboard / buttons
           ↓
app controller → session/history → pure engine
       ↓              ↓              ↓
renderer/layout   persistence     state + result
       ↑              ↓
  UI-only state   localStorage
```

No event bus, ECS, class hierarchy, virtual DOM, solver, worker or runtime dependency. Use plain objects/arrays and JSDoc for important contracts. One controller serializes game-changing actions; rendering and persistence observe its committed session.

## 2. Planned files (not yet created)

```text
index.html                         Polish document shell and viewport metadata
package.json / package-lock.json   scripts and locked dev dependencies
vite.config.js                     build base and Node Vitest configuration
playwright.config.js               browser matrix and production preview server
src/
  main.js                          mount app and register optional platform features
  app.js                           controller, dialogs, settings, pause and timer lifecycle
  engine/
    cards.js                       card identity, seeded shuffle and deal
    game.js                        validation, legal actions, transitions and invariants
    hints.js                       deterministic ranking; optional completion preflight
  session.js                       timeline, Undo/Redo, attempt accounting and statistics
  persistence.js                   schema, validation/replay, saving and tab ownership
  ui/
    render.js                      stable card/pile nodes, Polish labels and announcements
    input.js                       pointer/keyboard selection and command construction
    layout.js                      measured sizes, overlap, hit geometry and autoscroll
    cards.js                       SVG faces, pips and local court/back symbols
  styles.css                       responsive table, controls, focus and reduced motion
  assets/cards.svg                 original/licensed local SVG symbols
public/
  manifest.webmanifest
  icons/                           install and maskable icons, Apple touch icon
  sw.js                            native service worker template
scripts/build-sw.mjs               inject complete dist asset list and release cache ID
scripts/run-simulation.mjs         choose bounded CI/release profile and invoke Vitest
tests/
  unit/cards.test.js
  unit/game.test.js
  unit/hints.test.js
  unit/session.test.js
  unit/persistence.test.js
  unit/layout.test.js
  unit/simulation.test.js
  fixtures/                        valid full-deck scenarios and golden deal records
  e2e/                             play, input, layout, accessibility, storage, offline
.github/workflows/ci.yml            unit + browser + production build gates
.github/workflows/deploy.yml        tested artifact to GitHub Pages
README.md                          implementation-era commands and operation
THIRD_PARTY_NOTICES.md              asset licenses, only if third-party assets are used
```

Files can remain together until their responsibility warrants separation; preserve the engine/session/UI boundary. Tests import engine modules directly in Node, with actual browser tests in Playwright instead of a DOM emulation dependency.

## 3. Card and board model

Use `CardId` integer 0–51. Suit index is `floor(id / 13)` in the fixed order clubs, diamonds, hearts, spades; rank is `id % 13 + 1`. Color derives from suit, never stored. UI names are trefl, karo, kier, pik.

`GameState` contains:

| Field | Shape / meaning |
| --- | --- |
| rulesVersion | Integer 1, selects these game rules. |
| shuffleVersion | Integer 1, fixes the algorithm and deal order below. |
| seed | Integer 0–4294967295. |
| drawCount | 1 or 3; fixed throughout an attempt. |
| stock, waste | Arrays of CardId, bottom at index 0, playable/draw top at the last index. Visibility implied by pile. |
| tableau | Exactly seven `{ cards: CardId[], faceUpStart: integer }` columns. Prefix before faceUpStart is hidden; suffix is face up. Empty column has faceUpStart=0. |
| foundations | Four CardId arrays, fixed suit order, Ace at index 0, highest card last. |

Do not store duplicate card objects, suit/rank/color, legal moves, coordinates, selected card, clock, move count or win flag in GameState. Derive win from foundations. A session derives move count from its history cursor.

Invariants after every accepted transition and during restore:

- Exactly 52 distinct IDs in the integer range; no missing/duplicated cards.
- Seven tableau and four foundation arrays; legal enum and bounded numeric fields.
- Every nonempty tableau has at least one face-up card; faceUpStart is in 0..length−1. Its face-up suffix is descending in alternating colors. Hidden prefix has no ordering requirement.
- Each foundation contains only its assigned suit and contiguous ranks 1..length, at most 13.
- No independent face flags can contradict pile visibility. In a won board, stock/waste/tableau are empty.

## 4. Deterministic shuffle and deal

`createGame({seed, drawCount, rulesVersion=1, shuffleVersion=1}) → GameState` validates options. Start with IDs 0..51. Use a specified Mulberry32 generator with state initially equal to seed, including zero: each sample adds `0x6D2B79F5` modulo 2^32; mix with `t = imul(t ^ (t >>> 15), t | 1)`, then `t ^= t + imul(t ^ (t >>> 7), t | 61)`; output `((t ^ (t >>> 14)) >>> 0) / 4294967296`. JS bitwise operations and Math.imul define the 32-bit behavior.

Fisher–Yates iterates i=51 down to 1, choosing j=floor(random()×(i+1)) and swapping indices i/j. Use no random sort. Fisher–Yates is uniform given uniform samples; this finite seeded generator is reproducible, not cryptographic and does not span all 52! permutations.

Consume the shuffled array from its last index. For row=0..6, deal one card to columns row..6 in ascending order. Only the final card in each column is face up. The unused array, in its existing order, is stock. Freeze golden shuffled/dealt arrays for seeds 0, 1, 42 and 4294967295 before UI work. Any future shuffle/deal change must use a new version; keep a supported old version or reject its save explicitly.

Generate fresh seeds with browser crypto outside the engine; parsing an entered seed accepts only an unsigned decimal integer in range. For reproduction use seed + drawCount + rulesVersion + shuffleVersion, not seed alone.

## 5. Commands and transitions

One command union:

- `{ type: 'draw' }` when stock is nonempty.
- `{ type: 'recycle' }` when stock is empty and waste nonempty.
- `{ type: 'move', from, to }`, where a source is `{pile:'tableau', index:0..6, cardIndex}`, `{pile:'waste'}` or `{pile:'foundation', index:0..3}`; destination is tableau/foundation plus index. Tableau cardIndex identifies the start of the entire suffix.

Public engine functions:

- `validateMove(state, command) → {ok:true} | {ok:false, reason}`; stable reason codes are translated by UI.
- `applyMove(state, command) → {ok:true, state, revealed:CardId|null} | {ok:false, reason}`.
- `getLegalMoves(state) → Command[]`, including draw/recycle and foundation returns.
- `assertInvariants(state) → void` or throws a diagnostic error.
- `isWon(state) → boolean`.

Validate object shape, indices, source exposure, full sequence, different source/destination, target suit/color/rank, and stock preconditions before copying arrays. Invalid input never mutates state or history. Clone the small board and affected arrays only after validation; tests deeply freeze inputs. Reveal an uncovered tableau card in that same transition. No callback or animation can apply an extra reveal. Invariant checks run in tests/development and at restore boundaries; rule validation always runs in production.

Draw pops up to drawCount cards and pushes them to waste one at a time. Example: stock bottom→top `[D,C,B,A]`; draw 3 produces waste `[A,B,C]`, leaves stock `[D]`, and exposes C. Recycle waste `[A,B,C]` into stock `[C,B,A]`; next draw begins with A. If C was played, recycle `[A,B]` to `[B,A]`. This array convention is shared by tests and renderer.

## 6. History, clock and statistics

Session holds an attempt ID (browser-generated UUID), initial game options, a `commands` timeline, cursor, derived in-memory board snapshots for fast Undo/Redo, elapsed active milliseconds, `started` and `winRecorded` flags, and per-mode aggregate statistics. Snapshot index 0 is the deal; cursor selects the current board. Persist commands and cursor, not redundant snapshots. Execute a legal action by truncating the future, appending its command/state and incrementing cursor. Undo/Redo choose existing snapshots. Rejected actions never truncate redo.

Persist session fields explicitly as `{attemptId, options, commands, cursor, elapsedMs, started, winRecorded, knownCards}`; options contain seed/drawCount/rulesVersion/shuffleVersion. Statistics have keys `draw1` and `draw3`, each `{attempts, wins, bestTimeMs, fewestMoves}`; best fields are null until a recorded win. Preferences contain `drawCount` and `touchHelpSeen`. The cosmetic victory shuffle bag uses its own validated localStorage key and is not part of the game save envelope. Envelope metadata contains schemaVersion/revision/savedAt. Derived percentages and snapshots are not serialized. started remains true after Undo to cursor zero, and winRecorded remains true after branching away from a win; these flags describe lifetime events of the attempt, not just the current timeline.

Do not serialize the transient selection, gesture, DOM, monotonic timestamp, hint index or open menu. Full timeline including the redo tail is replayed and validated on load, then the cursor selects the board. Runtime snapshots are disposable caches of that timeline. New attempt/restart clears history and elapsed time but keeps statistics.

Clock belongs to app/session: accumulate `performance.now()` deltas only while active. A timer tick updates the label; it is not the source of elapsed time. Settle the interval before pause/hide/save/win, and reset the monotonic anchor on resume. Undo does not rewind elapsed time. After the first recorded win, subsequent practice can run the clock when the board is unwon, but never rewrites its best result.

First legal action marks started and increments the matching mode's attempts. First transition into won marks winRecorded and increments wins/updates best values. A single persisted envelope includes those flags, aggregates and history, so reloading a saved win cannot award it again. A save failure leaves that envelope entirely unchanged on disk, while the in-memory attempt continues with a warning. Restore validates `wins ≤ attempts`, nonnegative counters and logical flag relationships. Derived snapshots do not apply statistics during replay.

The first genuine win selects one effect from a separate four-item shuffle bag and finalizes win accounting before presentation. The existing result dialog follows the effect or its skip. Reduced motion bypasses effects; replayed/restored and practice wins do not select another effect. The UI owns and cancels the overlay/Canvas loop on skip, new game, destroy, page hide and resize; no visual card is written to session state.

Reference `rankHints` uses `getLegalMoves`, with a stable order: hidden-card reveal, foundation advance, other transfer, draw/recycle; ties use source pile/index/cardIndex then destination order. Never inspect hidden card identities for prioritization. The list may contain strategically poor or reversible moves; Help states it is assistance, not a solver. Optional completion uses a copied board and only foundation moves, at most 52 transfers; offer only if that simulation wins under F12.

### Reachable progress (T027)

`searchProgress(state, knownCards, {maxStates})` is a deterministic generator over
existing `getLegalMoves` / `applyMove`; it yields between expanded states and
returns `{status, visitedStates, noLegalMoves}` with optional `goal` on
PROGRESS_FOUND. Status is PROGRESS_FOUND, NO_PROGRESS, UNKNOWN, or WON (checked
first). After each legal transition, REVEAL uses `applied.revealed != null`,
FOUNDATION_ADVANCE means the total foundation count exceeds the analysis root,
and INFORMATION means `visibleCards(after)` contains a card outside the initial
remembered set. Waste transfers, known draws and foundation returns are neutral
BFS preparation. A newly revealed or newly visible card ends that branch before
its value can guide another simulated move.

The visited key includes rules, draw mode, tableau ordering/orientation,
foundations, exact stock/waste order and knowledge. Hidden tableau identities
are omitted because every revealing edge ends at P1; stock identities are opaque
order tokens, never hidden-rank heuristics. No history, clocks or UI state enter
the key. All neutral branches, including foundation returns, are explored;
cycles alone prove nothing. Limit: 10,000 discovered states, no depth cutoff.
A nonempty frontier at the limit produces UNKNOWN, never NO_PROGRESS.

The controller uses roughly 4 ms batches and a 100 ms active-computation budget,
with state boundaries as cancellation points. It cancels on board/knowledge
replacement and destruction, ignores stale results, and does not restart on
timer-only changes. Analysis neither changes nor saves a session. Subscribers receive an optional second `progressOnly` argument on analysis completion; the renderer then updates only the notice, preserving board nodes, focus and move animations. UI uses a
nonmodal polite status notice, hides it during pause/dialogs and wins, and keeps
normal play/Undo available. A proven negative result takes precedence over
cycling preparatory hints. UNKNOWN does not warn; bounded SmartHint may independently return uncertainty. Both automatic notices and Hint share next-step text: new game, plus Undo only when the session cursor is positive, without promising that Undo will resolve the position.

Session knowledge is a frozen unique array, accumulated from all exposed tableau
cards, foundations, and the last one/three waste cards, matching the renderer.
It survives Undo, Redo, discarded branches and reload; new/restarted attempts
reset it. Knowledge stays outside board state and never affects hint ranking.

### SmartHint service (T028; strategic revision validation pending)

[T028-spec](.project/tasks/T028-spec.md) defines a separate pure
`searchSmartHint(state, knownCards, options)` generator using existing legal
commands and immutable simulations. The controller schedules cancellable work;
UI shows the first command and goal without executing it. Recompute after board
or knowledge changes. Plans/scores never enter board, history or persistence.
Reuse progress keys/knowledge only where their semantics match; heuristic
ranking and depth limits must not weaken `searchProgress` exhaustion rules.
SmartHint supersedes hint cycling and the ordinary-legal-hint fallback above;
knowledge will identify information boundaries, never rank concealed values.

SmartHint strategic revision keeps Best-First Search and shared getLegalMoves /
applyMove. Waste/tableau transfers and foundation returns are intermediate;
only H>0 or net F>0 confirms FOUND. A new-information boundary permits
EXPLORATION and stops expansion. U weights remain unchanged; M/B count direct
reveal/foundation opportunities, excluding standalone waste transfers.
Register a recommendation only on an edge adding H/F/I, so later preparation
cannot pad a goal plan. Keep expanding preparation after earlier goals to find
later progress; reachability, scoring weights and root-relative goals stay unchanged.

If a SmartHint search ends without truncation and encountered no strategic or
information goal, it returns NO_STRATEGIC_PROGRESS with no recommendation.
Any cutoff without a recommendation remains INCONCLUSIVE/truncated. This status
describes only the configured SmartHint search and is not the formal F04 result.

The result carries H/F/I/W/M/B/L and terminal verification. Retained nodes and
edges share the main state budget; goal alternatives reference those nodes.
Final verification reads the already explored graph (bounded by maxStates,
yield every 64 reads) to discard proven dead continuations, preserving UNKNOWN
scope as UNPROVEN. A one-ply check reports terminal actions and lost mobility;
it is not a safety proof. No hidden-value continuation, new game rules or
heuristic F04 NO_PROGRESS. Existing diagnostic export includes these observations.

## 7. Persistence and ownership

T028 diagnostic export is a separate JSON wrapper (`format:pl.solitaire.hint-diagnostic`,
`formatVersion:1`): `save` is the unchanged schema-v2 serialized envelope, with
build/export time, current hint/progress and effective hint budgets alongside it.
It reads the current in-memory session without writing localStorage or modifying
history/statistics. Replay only `save` through `restoreSession`; diagnostic fields
are observations and never authoritative board data. The menu downloads via a
temporary Blob URL, reports preparation/download errors in Polish, and releases
the URL after dispatch. There is no in-game import or automatic save replacement.

One namespaced localStorage key, `pl.solitaire.save`, holds an envelope with `schemaVersion:2`, integer revision, savedAt (diagnostic wall-clock ISO time), preferences, aggregate stats and session. An origin can host other GitHub Pages apps; prefix all keys and cache names. This game has one active save slot.

`serializeSession(session, metadata) → string`; `restoreSession(text) → {ok:true, session, metadata} | {ok:false, reason}`. Explicitly construct allowed fields. Before JSON parsing, reject more than 1 MiB UTF-8, and after parsing reject more than 10,000 history commands, malformed arrays, unsupported versions or nonfinite/negative numbers. Cursor must be an integer in 0..commands.length. Replay every command, including future commands, through the engine. Validate settings, flags and stats; do not trust a supplied board snapshot. These are defensive persistence limits, not a cap on in-memory play or Undo: if reached, stop saving, retain the previous save and tell the player that further progress is temporary. Never silently truncate history.

Schema v2 adds a bounded, unique array of CardIds `knownCards` (0–51), including every currently visible card. Schema v1 is replayed unchanged and migrated in memory with only currently visible knowledge; never infer past stock knowledge from hidden values or discarded history. Subsequent saves write v2. Unknown newer versions are left untouched. Invalid data is not automatically deleted. Clear/replace only through an explicit player action.

Save synchronously after committed user actions and on the lifecycle schedule in F08; never during pointermove. Catch reads and writes, including unavailable storage and quota exceptions. Setting a single key avoids partially saved game/statistics records. A successfully saved envelope is the recovery boundary; sudden process termination before a write cannot be made durable by JavaScript.

Acquire an exclusive Web Lock named `pl.solitaire.writer` before loading mutable state, hold it for the tab lifetime, and offer retry in a read-only second tab. Feature-detect locks. Fallback: remember the loaded revision, compare it immediately before each write, increment it, listen for storage changes and freeze a conflicting tab's saving/play until explicit reload. This fallback cannot guarantee atomic exclusion of truly simultaneous writes; show a one-tab-only notice on that path and test conflict detection. No invented localStorage spinlock or last-writer-wins merging.

## 8. Layout and rendering

Measure the usable board content width W after safe-area/padding with ResizeObserver. For narrow viewports choose gap g=3 px; above 360 px g=4 px, desktop up to 10 px. Set `cardWidth = min(104, (W − 6g)/7)` and `cardHeight = 1.4 × cardWidth`; center the board if capped. Write dimensions once per resize as CSS custom properties. At 320 px with 8 px side padding: W=304, cardWidth≈40.86. Do not round each column upward; keep subpixel CSS positions.

Columns share one vertical scroller. Preferred face-up overlap is `max(24, 0.28 × cardHeight)`; hidden overlap 12 px. If necessary reduce hidden overlap to 8 px, then face-up overlap to 24 px. For a column with d hidden and u visible cards, its height is `d×hiddenOverlap + max(0,u−1)×faceUpOverlap + cardHeight`. If it still exceeds the available height, grow the scroller content. No font shrinking to conceal overflow. Bottom card remains fully displayed. Top piles and controls use separate rows, with safe-area padding and dynamic viewport height.

Waste uses a two-column area. In Draw 3 fan up to three cards with horizontal offsets fitting that area; indicate which one is playable. Exposed tableau corner indices use a compact horizontal rank+suit treatment inside the 24 px band. Hidden card SVGs render only backs. Each card is a stable DOM node keyed by ID, positioned with transforms inside pile containers; update affected piles and labels on commit. Drag uses a visual clone/overlay marked aria-hidden, never a second logical card. Decorative SVG is hidden from assistive technology; the card/pile control owns its Polish label.

Use local reusable SVG symbols for pips, face art and backs, with an ivory face/border. Create original vector court designs or use compatible licensed assets and record attribution. Inspect A, 10, J, Q, K of all suits at actual 320 px scale before detailed decoration. System fonts avoid layout/network dependence.

## 9. Input and accessibility

UI state is `{selection, gesture, focus, hintIndex}` outside GameState. A gesture tracks primary pointer ID, source, initial point, latest point and starting layout revision. Ignore secondary pointers as game input. Mouse can drag an unselected legal source immediately. On touch, movement beyond the 6 CSS px threshold on a face-up card starts dragging it in the same gesture; a tap still selects for tap-to-move. Face-up cards use `touch-action:pinch-zoom`, while open tableau space and face-down cards retain vertical panning; scroll buttons remain available. Preserve pinch zoom.

Face-up cards are drag surfaces and allow `pinch-zoom`; open tableau space and face-down cards allow `pan-y pinch-zoom`. Changing touch-action mid-gesture cannot reclaim a gesture already taken by the browser. If the browser takes a pinch or sends pointercancel, cancel the drag. Preserve pinch zoom and scroll buttons; never set touch-action:none globally. See [MDN touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/touch-action).

On touch, two taps within 350 ms on the same movable face-up card execute the current displayed hint when its source matches; otherwise use the first legal destination (tableau columns, then foundations). The second tap must end without starting a drag and the board must be unchanged. A mouse second click (click detail=2) executes only a matching current hint; otherwise ordinary selection behavior applies. Both paths share recommendedDestination: check board identity, current app hint identity, exact source and validateMove, then use executeMove/session commands. After a move or Undo/Redo, old recommendations cannot execute. Keyboard input is unchanged.

Capture the pointer for a drag. Batch overlay movement with requestAnimationFrame using transform only; ignore the overlay in hit testing. Hit-test pile rectangles at the pointer point, not event.target under capture. Cache geometry, refresh after scrolling/resizing, highlight only legal destinations through engine validation. On release revalidate against the current state and commit at most once. Suppress the follow-up click only for the gesture that committed as a drag. Release outside/invalid target animates back; pointercancel, lostpointercapture, hidden page, resize and Escape clean up without a move.

Autoscroll when dragging within 32 px of tableau top/bottom, speed proportional to proximity up to 240 px/s; scroll only that container and recompute hit rectangles. Selected-source tap followed by a destination tap remains possible across manual scrolling. Native browser scrolling is not cancelled outside a card drag.

Use semantic buttons and a labelled board group, roving focus across exposed cards/empty piles, arrow navigation within/between piles, and Enter/Space through the same selection/command path. Tab can leave the board. After a move restore focus to the moved sequence's exposed end or relevant pile; dialogs restore prior focus. Escape dismisses selection/drag before dialog navigation. Live region announcements describe one committed action including its reveal; timer changes stay silent. Arrow navigation scrolls the focused card into view.

Within tableau, Up/Down move along exposed cards, Left/Right to the nearest visible card by vertical position in the adjacent column. Up from a column's first exposed card enters the nearest upper pile; Down from an upper pile enters the nearest column. Left/Right traverse upper piles in visual order. Empty columns remain focusable destinations; hidden cards never become selectable keyboard sources.

## 10. Build, offline and deployment

Choose mutually compatible current stable tool versions and supported Node LTS during phase P1, then commit the lockfile and record versions; no dependency installation is part of this design. Configure Vite's `base` for the actual GitHub Pages repository path (or `/` for a root/custom-domain site); public URLs use the build base. Deploy `dist` through GitHub Actions after checks. See [Vite GitHub Pages guide](https://vite.dev/guide/static-deploy.html#github-pages).

No client-side routes; navigation is a single index document. Test both `/` and a non-root `/Solitaire/` preview. Manifest start_url/scope and service worker URL/scope stay inside the same base. Browser-native PWA support uses a small service worker, without Workbox: after Vite builds, a Node script enumerates first-party dist assets, excluding the worker itself, and injects their base-aware URLs plus a content-derived release ID into the worker template. Precache the complete app shell/card assets/icons on install. Test the generated output, not just the template.

Use a release-specific cache; serve cached same-origin precached assets and the shell for the app's entry URL. Do not intercept other applications or arbitrary cross-origin requests. A partial installation fails without replacing the active worker. New workers wait; show “Dostępna aktualizacja” and activate/reload only after the player accepts, saving succeeds, and no gesture is active. Retain the current and immediately previous app cache through activation to allow existing tabs to finish; delete only older caches owned by this app. Never use an unconditional skipWaiting on installation. Follow the [service-worker lifecycle guidance](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

Offline readiness is reported only after successful install and control of the page. First-ever offline visits are unsupported. Detect installation affordances; offer native prompt where available and Polish platform instructions elsewhere. localStorage remains the save mechanism; service-worker cache stores application assets, not game state. [Browser storage behavior](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) requires explicit failure handling.

## 11. Risk reduction order

Prove rule ordering/history first, then build the 320 px interaction layout with simple SVG cards, and test real touch before committing to illustration polish. Validate storage failures and offline updates before deployment. Performance or layout fixes must preserve the pure-engine contract and accessible tap/keyboard path.

Technical documentation checked through Context7 on 2026-10-10: [Vite](https://vite.dev/guide/static-deploy.html), [Vitest environments](https://vitest.dev/guide/environment.html), [Vitest coverage](https://vitest.dev/guide/coverage.html), [Playwright emulation](https://playwright.dev/docs/emulation) and [Touchscreen API](https://playwright.dev/docs/api/class-touchscreen). Recheck exact package APIs during implementation. The documented Touchscreen API provides taps; synthetic drags alone are not real-device gesture evidence.
