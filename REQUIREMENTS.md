# Klondike Solitaire — requirements

Status: design deliverable, 2026-10-10. No application implementation is authorized by this document alone. The current task ends with the five design documents; implementation needs a subsequent user instruction.

## 1. Purpose and scope

Build a polished, dependable, single-player Klondike game, primarily for portrait smartphones at 320–430 CSS px, also usable in landscape and on desktop. All player-facing text, accessible names, errors, help, installation instructions and statistics are Polish (`lang="pl"`). Technical identifiers and documentation may be English.

The release uses HTML5, vanilla JavaScript ES modules, CSS3, SVG cards, Vite, Vitest, Playwright and localStorage. It runs entirely on static GitHub Pages hosting. No runtime framework, backend, database, account, remote font, analytics or external asset service is required.

The required release includes offline play and installation support after a successful online load. Automatic completion is an optional, separately gated enhancement. A solver, guaranteed-winnable deals, scoring systems, daily challenges, leaderboards, sound, advertisements, multiple themes and multiplayer are outside the initial scope.

## 2. Chosen rules (authoritative)

| ID | Requirement and decision |
| --- | --- |
| R01 | Exactly 52 unique cards, four suits, ranks Ace=1 through King=13, no jokers. Hearts/diamonds are red; clubs/spades black. |
| R02 | Shuffle deterministically from an unsigned 32-bit seed. Preserve shuffle and rules version with the seed. New Game generates a seed; Restart reproduces the same deal and draw mode. Display/copy the seed and allow a decimal seed in the New Game dialog for reproduction. Random deals need not be winnable. |
| R03 | Deal seven tableau columns of lengths 1–7, with only each column's last card face up. The remaining 24 cards form the face-down stock; waste and four foundations start empty. Deal order is fixed in ARCHITECTURE.md. |
| R04 | Tableau builds downward by one rank in alternating colors. Only a King, alone or heading a legal face-up sequence, may enter an empty column. |
| R05 | A tableau move transfers the selected face-up card and every card above it toward the exposed end. The entire suffix must be descending and alternating. Moving only part of that suffix, or any face-down card, is illegal. |
| R06 | Foundations have fixed suits and build Ace through King in ascending order. Only one exposed card moves to a foundation at a time. An exposed foundation card may move back to a legal tableau destination. Foundation-to-foundation moves are not allowed. |
| R07 | Only the top waste card is playable. It may move to a tableau or foundation. Stock cannot be moved directly to either. No player move targets waste or stock. |
| R08 | Draw 1 is the default. Draw 3 transfers up to three stock cards one at a time; the last transferred card is the playable waste top. Drawing again is allowed while waste is nonempty. With fewer than three stock cards, draw the remainder. |
| R09 | An action on an empty stock recycles all remaining waste, face down, without shuffling, reversing the waste array so its oldest remaining card is drawn first. Recycling is a separate action; it does not also draw. Unlimited recycling in both modes, no penalty. Empty stock plus empty waste does nothing. |
| R10 | After a tableau transfer, automatically reveal the newly exposed face-down card. Transfer and reveal form one atomic move. Revealing cannot be performed independently. |
| R11 | A win means all 52 cards are on their four legal foundations. Do not declare a loss merely because no immediate transfer is available. |

## 3. Functional behavior

| ID | Requirement and acceptance behavior |
| --- | --- |
| F01 | Tap a movable source to select it; tap a highlighted legal destination to move. Retap the same source or tap blank table to deselect. An illegal destination leaves the selection and board intact and explains the rejection briefly. An unhighlighted movable card selects a different source; destination interpretation takes priority when legal. A mouse double-click or touch double-tap on the source card of the currently displayed hint executes that exact validated move once. Without a matching current hint, touch double-tap retains the first currently legal destination in the existing order; mouse clicks retain selection behavior. Repeating the gesture evaluates the current board; stale hints after moves or Undo/Redo cannot execute. |
| F02 | Support mouse dragging and touch dragging through Pointer Events. On touch, movement beyond the 6 CSS px threshold on a face-up card starts dragging that card/sequence in the same gesture; a tap still selects it for tap-to-move. A face-up card is a drag surface, while open tableau space and face-down cards remain vertical scroll surfaces. Preserve pinch zoom. Teach this in Polish and in Help. A drag is one move; cancellation, loss of capture or an outside drop makes no move. |
| F03 | Undo and Redo restore complete board states, including reveals, draws and recycling. Keep history for the entire current attempt, including across reload when persistence succeeds. A new legal action after Undo discards the redo branch. Selection, rejected moves and hints do not change history. |
| F04 | Hints show the first legal action of a bounded strategic sequence using visible information; confirmed goals are tableau reveal or net foundation advance, while new information is exploration. Repeated requests reuse the current result until the board/knowledge changes. Separately search all reachable preparatory states for tableau reveal, net foundation increase from the analysis root, or a previously unknown card becoming visible through draw, tableau reveal or waste fan. Waste transfers, known draws and foundation returns are preparatory and remain searchable. A completed negative search shows “Brak ruchów prowadzących do dalszego postępu.”; an empty legal list shows “Brak dostępnych ruchów.”. Incomplete/resource-limited analysis is UNKNOWN and must not warn. WON takes precedence. Never claim the deal is unwinnable. See T027 and T028 follow-up specs. |
| F05 | “Nowa gra” starts a fresh attempt with chosen Draw 1/Draw 3 and optional seed. “Rozdaj ponownie” starts a fresh attempt with the same seed and mode. Confirm replacement of a started, unwon attempt; cancelling preserves board, timer and history. A draw-mode change starts a new attempt and uses the same confirmation. Persist the preferred mode for the next game. |
| F06 | Count each successful transfer, draw or recycle as one move. An automatic reveal adds no move. Undo reduces the displayed count; Redo restores it. Count equals the applied history length. Hints, selection, failed actions, New Game and Restart add no moves. |
| F07 | Timer starts on the first legal game action, measures visible active play and pauses while hidden, explicitly paused or covered by an app dialog. Pausing conceals cards and disables play. Resume requires dismissal of the pause screen; a restored started game initially shows it. Time is not undone. A currently won board stops time; undoing that win can resume play. Use monotonic intervals, not tick counts. |
| F08 | Automatically save the board, seed/versions/mode, undo/redo history, known-card identities, elapsed time, preferences and statistics. Save after each committed action and history navigation, preference change, pause/resume and attempt change; checkpoint running time every five seconds and on page hide. Reload restores a valid save without counting hidden/offline time. Target at most five seconds of unsaved timer progress under normal scheduling; a browser freeze, suspended process or failed write can extend this interval. |
| F09 | Corrupt, unsupported-version, too-large or inaccessible storage must not crash the game or silently overwrite the existing save. Explain in Polish and allow an explicit new game that replaces it, or temporary play without persistence. Failed writes retain the last valid stored value and show “Nie udało się zapisać gry”. |
| F10 | Statistics are local and separated by draw mode: attempts started, wins, win percentage, best winning time and fewest winning moves. Count an attempt at its first legal action, not on deal. Count only its first win. Restart creates another attempt; Undo/Redo/reload of a win cannot award another win or improve its recorded result. Win percentage is wins / started attempts, including ongoing and abandoned attempts; zero attempts displays 0%. No loss streak or scoring. |
| F11 | A first genuine win plays one randomized victory animation before the Polish win dialog with time/moves and New Game/continue viewing controls. “Pomiń” and reduced motion proceed directly to the dialog. Undo remains available after closing it. Opening a saved won board shows its result without re-awarding statistics. A later win within that same attempt is practice and does not reopen the celebration. |
| F12 | Optional “Dokończ automatycznie” is offered only with stock and waste empty and every tableau card face up. Preflight repeated legal foundation moves on a copy until won; offer only on success. Execute as individual undoable moves, stop on cancellation/Undo/pause/hide, and never race player input. No mid-game automatic foundation transfers. |
| F13 | A second tab must not silently overwrite a game being played elsewhere. One writable session per origin/app; other tabs show a read-only notice. If an exclusive browser lock is unavailable, use a revision-conflict check and stop saving on conflict. No cross-tab game merging. |

## 4. Mobile layout and presentation

| ID | Requirement and measurable target |
| --- | --- |
| U01 | Seven tableau columns always fit across the available width at 320, 360, 390 and 430 CSS px, without horizontal scrolling, clipping or overlap between columns. Derive card dimensions from the measured board, not a device name. Portrait is the primary layout. |
| U02 | At 320 px, minimum outer padding is 8 px, inter-column gap 3 px and card width approximately 40.9 px. Use a 5:7 card ratio. Desktop width is capped at 104 px per card with a centered board. Safe-area insets reduce available space before sizing. |
| U03 | Keep exposed face-up card bands at least 24 CSS px tall and corner ranks at least 14 CSS px at the smallest supported width. Face-down overlap can compress to 8 px. If a column exceeds available height, scroll the tableau vertically instead of shrinking below these limits. Every exposed card and column end remains reachable. |
| U04 | Upper piles and bottom controls stay reachable outside the tableau scroller. Provide accessible scroll buttons and normal scrolling from open tableau space and face-down cards. Buttons page the tableau. During a card drag, edge autoscroll changes only the tableau scroller. |
| U05 | Stock uses the first top-row slot; waste can fan over slots 2–3; four foundations occupy slots 4–7. Show at most the last three waste cards in Draw 3, only the top interactive. In Draw 1 show the top only. Fan never covers foundations. Show stock count and clear recycling/empty state. |
| U06 | Primary controls: “Cofnij”, “Ponów”, “Podpowiedź”, “Menu”; minimum 44×44 CSS px targets and visible disabled states. Menu contains New Game, Restart, Pause, draw preference, Statistics and Help. Card targets cannot all be 44 px at 320 px width; use the full exposed band (at least 24 px high), precise non-overlapping hit regions and selection feedback. Do not claim all cards meet a 44 px target. |
| U07 | Green felt-like table, ivory card faces, dark high-contrast ranks, distinct suit shapes, restrained gold accents, symmetrical face-card artwork and an elegant patterned back. SVG retains crisp detail at device pixel ratios 1–3. A–10 use rank-appropriate pips; J/Q/K have distinct vector portraits. Keep A/J/Q/K glyphs; accessible names use Polish ranks/suits. |
| U08 | Selection, legal destinations, invalid drop, focus, hint and win use outlines/shapes/text as well as color. Dragged sequence follows the pointer with a small lift/shadow; source placeholder preserves geometry. Animation duration 120–180 ms, no animation delays state correctness. Reduced motion removes travel/flip/celebration animation. |
| U09 | Recalculate on board resize, orientation, safe-area and browser-toolbar viewport changes. Cancel an active gesture before resizing. Use dynamic viewport units with a fallback; never lock orientation. At 568×320 landscape, allow vertical tableau scrolling and wrap menu contents without obscuring controls. |

## 5. Accessibility, quality and reliability

| ID | Requirement and acceptance target |
| --- | --- |
| N01 | Complete play via keyboard: Tab between controls/board, arrows between piles and exposed cards, Enter/Space selects and moves, Escape cancels/closes. Ctrl/Cmd+Z undoes; Ctrl/Cmd+Shift+Z and Ctrl+Y redo, outside text fields. Visible focus survives moves, Undo and dialogs. Foundations, waste, stock and empty columns have meaningful Polish labels. |
| N02 | Screen-reader announcements describe committed moves, reveals and invalid actions; avoid timer announcements every second. Face-down ranks are absent from DOM text, accessible names and SVG markup. Dialogs manage/restore focus. Help explains sequences, draw modes, touch dragging and scrolling. |
| N03 | Text contrast target 4.5:1, focus/control boundaries 3:1. Preserve browser zoom; menus and help reflow at 200% text scaling. Verify board play at 200% zoom with accessible navigation. Seven-column fit is measured at normal zoom; zoomed users may pan the magnified viewport. Do not disable zoom with viewport metadata. |
| N04 | Support Android Chrome and iOS Safari current and previous major release at release time; desktop current Chrome, Edge, Firefox and Safari. Record actual browser/OS versions in the release test evidence. Playwright WebKit emulation does not replace testing on an iPhone. |
| N05 | On a recorded midrange Android device: input-to-feedback p95 ≤100 ms, pointer animation frame interval p95 ≤20 ms in a 10-second drag, no app-induced main-thread task >50 ms during ordinary moves. Initial route LCP ≤2.5 s and CLS ≤0.1 under the fixed mobile profile in TEST_PLAN.md. |
| N06 | Initial application JS+CSS ≤100 KiB gzip, all first-load assets ≤500 KiB gzip. No runtime network request is needed for play after assets load. Use system fonts and local SVG; adding dependencies requires a concrete need. Dev dependencies initially limited to Vite, Vitest, matching V8 coverage provider and @playwright/test. |
| N07 | Every state has exactly 52 unique cards with legal pile ordering/visibility. Transitions are deterministic and immutable, with invalid commands rejected without partial changes. Engine has no DOM, browser storage, clock or ambient randomness dependency. |
| N08 | localStorage is untrusted input: bound size/work, validate all fields and replay every saved move. Serialize through an explicit versioned schema. No stored string becomes executable HTML/SVG. Local browser storage may be cleared or denied; data is not synchronized or guaranteed permanent. |
| N09 | A manifest and service worker support standalone installation where the browser offers it and full offline play after an explicit readiness signal. Cache installation must succeed completely before reporting readiness. Updates wait for a safe user-accepted reload after saving; do not reload mid-move. |
| N10 | GitHub Pages project-subpath deployment must load assets, manifest and service worker correctly. HTTPS production, repeatable locked installation/build, automated tests before deployment and a smoke test of the deployed URL. No routing fallback or server API is needed. |
| N11 | Require all mandatory tests and mobile checks in TEST_PLAN.md before claiming production readiness. Seed simulations check correctness, not solvability. No unexplained test skips, console errors, card loss, duplicate awards or silent save failures. |

## 6. Ambiguities resolved and risks

The rules above deliberately choose unlimited recycling, reversible foundations, immediate automatic reveals, no score and Draw 1 as default. Restart is a new statistical attempt. Timer and lifetime statistics are outside Undo. Changing draw mode replaces the game. The seed reproduces a deal, while the command history reproduces its later state.

The largest usability risk is the conflict between seven narrow columns, readable overlapped cards and native touch scrolling. The selected-card drag model and minimum overlap must be validated before polishing artwork. Long columns may scroll vertically: fitting every card into one screen is not a requirement.

Other release risks are Safari pointer cancellation/safe areas, Draw 3 ordering, history compatibility, localStorage failure and competing tabs, offline cache updates, and the licensing/legibility of court artwork. Their mitigations and required evidence are assigned to implementation phases and tests. “Production-quality” is an acceptance target, not a claim made by this design.

## F04 extension — T028 SmartHint (validation pending)

Approved diagnostic follow-up (2026-10-11): menu action "Zapisz stan do analizy"
downloads a replayable JSON session with hint/progress/build/budget observations.
Preserve knowledge and the full Undo/Redo timeline. Export must leave the board,
history, statistics and local save intact; download failures use Polish feedback.

The coordinator requested [T028](.project/tasks/T028.md) and its
[specification](.project/tasks/T028-spec.md). On implementation, replace cycling
legal hints with the first move of a scored goal-directed sequence and a Polish
explanation. Use only permitted information, stop at information boundaries,
compare alternatives, and return uncertainty when bounded search finds no plan.
Only the separate complete F04 analysis may report NO_PROGRESS. The reference rankHints ordering remains available for comparison; it is not
an automatic fallback when SmartHint has no strategic recommendation.

T028 proposal adaptation (assigned 2026-10-13): prioritize positively scored
tableau reveals, preferring shorter reveal plans before incidental waste gains.
Use a hidden-safe, color-correct estimate only to break equal-length reveal
ties. Preserve positive U and strict budgets. Current terminal verification
checks achieved effects; future graph progress is not required (integration 2026-10-14). In the p95
follow-up, information prefers shorter plans; foundations prefer more net F,
less B and then shorter plans. Real multiple advances still outrank incidental W.
Shorten only the final winner while preserving its goal and verification scope.
Diagnostic alternatives do
not add UI controls, automatic moves or a solvability guarantee.

T028 strategic-goal revision (2026-10-11): FOUND requires a positively scored
sequence revealing hidden tableau or making a net foundation advance relative
to the analysis root. End a recommendation on a command adding reveal,
foundation or information progress; do not append preparations after its last
goal. Continue exploring those preparations for further goals. Waste transfers,
known draws/recycle and foundation
returns are preparation. EXPLORATION requires genuinely new information.
Repair revision 2026-10-14: verify achieved effects and report available actions;
foundation progress does not require another future goal. Preserve the best
accepted plan at every yield. Waste rewards guide preparation only; known stock
navigation is cheaper and the default horizon is 32 commands. Unknown continuation
remains uncertain; never infer unwinnability. F04 searchProgress P1–P4 semantics are
unchanged, so PROGRESS_FOUND can coexist with SmartHint INCONCLUSIVE.
SmartHint may report NO_STRATEGIC_PROGRESS only after its configured search
finishes without truncation and finds no strategic or information goal. This is
not F04 NO_PROGRESS and does not claim the deal is unwinnable.

T028 integration (2026-10-14): waste gain only prioritizes preparation; tableau
reveal never earns I based on hidden memory. Known draw/recycle cost 0.5 in
final utility; incidental foundation prefixes do not pad reveal utility.
Default maxDepth is 32, maxStates 10000, active time 100 ms. Preserve app
cancellation/continuation and the complete-search-only negative status. See
[the integration report](.project/reports/T028-integration.md) for measured evidence.
