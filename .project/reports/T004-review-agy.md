# Independent Code Review: T004 — Stock recycling and complete legal-action enumeration

## Reviewed commit

- Commit hash: `1073dfb1828dff1944713c616c9019cfcdc14056`
- Commit subject: `T004: implement stock draw, recycle and legal-move enumeration`
- Reviewer: Senior Software Engineer (Antigravity)
- Scope: Independent review of `src/engine/game.js`, `tests/unit/game.test.js`, and project documentation (`.project/tasks/T004.md`, `.project/reports/T004.md`, `.project/HANDOFF.md`, `ARCHITECTURE.md`, `TEST_PLAN.md`, `REQUIREMENTS.md`).

---

## Tests executed and exact results

| Command / Check | Result | Details |
| --- | --- | --- |
| `npm test` | **PASS (exit 0)** | 3 test files, 58 tests passed (Vitest v5.0.3, duration: 1.10s) |
| `npm run test:coverage` | **PASS (exit 0)** | Statements: 98.63%, Branches: 98.57%, Functions: 100%, Lines: 100% |
| `npm run build` | **PASS (exit 0)** | Vite v8.3.4, 5 modules transformed, bundle sizes: HTML 0.98 kB, CSS 0.91 kB, JS 0.67 kB |
| Independent Seeded Simulation | **PASS** | 200 deals (100 Draw 1, 100 Draw 3), 40 000 legal actions executed, 40 200 invariant assertions |
| Independent Candidate Move Generation | **PASS** | Exhaustive independent candidate generation across 40 000 game states: 0 omissions, 0 invalid moves, 0 duplicates |
| Deep Stock & Waste Tests | **PASS** | Hand-calculated fixtures, Draw 1/3 batches, remainder handling, recycling order, waste card consumption cycles |
| Malformed State Investigation | **PASS** | Verified behavior of `isWon`, `assertInvariants`, `validateMove`, `applyMove`, and `getLegalMoves` on malformed inputs |

---

## Detailed algorithmic analysis

### A. Stock and waste
1. **Draw 1 and Draw 3 behavior (`src/engine/game.js`, lines 244–257)**:
   - Draw 1 pops exactly 1 card from the stock top and appends it to waste.
   - Draw 3 pops up to 3 cards one-by-one from the stock top onto the waste, reversing the sliced batch (`state.stock.slice(-count).reverse()`) so that the oldest of the drawn batch sits below and the newest sits on top.
   - Hand-calculated example `stock [D,C,B,A]` (IDs `[16, 51, 38, 1]`): drawing 3 yields waste `[A, B, C]` (`[1, 38, 51]`) and leaves stock `[D]` (`[16]`), exposing `C` (`51`).
2. **Remainder batches**:
   - `count = Math.min(state.drawCount, state.stock.length)` correctly handles stocks with 1 or 2 remaining cards in Draw 3 mode without throwing or padding.
3. **Playable waste card & exposure**:
   - Only the top waste card (`state.waste.at(-1)`) is accepted as a transfer source (`readSource`, line 152). Buried waste cards cannot be targeted because `{ pile: 'waste' }` forbids extra keys like `cardIndex` (rejected as `invalid-command`).
   - Transferring the waste top card exposes the next card beneath it, as verified across multi-step play sequences.
4. **Recycling mechanics (`src/engine/game.js`, lines 258–267)**:
   - Recycling is rejected with `illegal-source` if `state.stock.length !== 0` or if `state.waste.length === 0`.
   - Empty stock + empty waste rejects with `illegal-source` without mutating state.
   - Recycling reverses the remaining waste (`state.waste.slice().reverse()`) into stock and clears waste to `[]`.
   - Recycling is a separate action that does not draw.
   - Unplayed Draw 3 cycles retain identical card order across repeated cycles. Playing exposed cards preserves the relative order of unplayed cards across recycling cycles.

### B. Legal move enumeration
1. **Enumeration completeness and correctness (`src/engine/game.js`, lines 298–328)**:
   - Checked against an independent brute-force candidate move generator that evaluates every possible Klondike command across 40 000 game states:
     - Missing legal moves: **0**
     - Illegal moves included: **0**
     - Duplicate moves: **0**
   - Every move returned by `getLegalMoves(state)` validates with `validateMove(state, move).ok === true` and executes successfully via `applyMove(state, move)`.
2. **Scan ordering**:
   - Deterministic and stable:
     1. `{ type: 'draw' }` (if legal)
     2. `{ type: 'recycle' }` (if legal)
     3. Tableau columns 0..6, with `cardIndex` ascending from `faceUpStart` to column top. For each source, destinations are checked for tableau 0..6 then foundations 0..3.
     4. Waste pile top (if nonempty), trying tableau 0..6 then foundations 0..3.
     5. Foundation piles 0..3 (if nonempty), trying tableau 0..6 then foundations 0..3.
   - Distinct from hint prioritization (which is intentionally deferred to T014).
3. **Blocked and won states**:
   - A blocked board with no legal moves returns `[]` without concluding a loss (`isWon` returns `false`).
   - A won board (all 52 cards on foundations) returns 28 legal foundation-to-tableau King return moves, consistent with Klondike rules allowing foundation card returns.

### C. State integrity
1. **52-card conservation & immutability**:
   - Exactly 52 distinct card IDs (0–51) are preserved across all transitions.
   - `applyMove` and `validateMove` return deeply frozen objects (`Object.freeze`) and never mutate input states. Tested by deep equality checks against input snapshots before and after move application.
2. **Command validation**:
   - Extra fields in commands (e.g. `{ type: 'draw', extra: true }`) are strictly rejected with `invalid-command`.
   - Corrupted `drawCount` (e.g. 2) is rejected with `invalid-state`.

---

## Investigation: `getLegalMoves` and malformed tableau columns

The coordinator specifically requested an investigation of whether `getLegalMoves` can throw for malformed tableau columns (null), and whether this violates the documented API contract.

### Technical findings:
1. **Observed behavior**:
   - If `state.tableau[i] === null` or `state.tableau[i] === undefined`:
     - `canReadBoard(state)` (lines 226–235) checks `Array.isArray(state.tableau) && state.tableau.length === 7`. It returns `true`.
     - In `getLegalMoves(state)` (line 318), `const column = state.tableau[index]` retrieves `null`.
     - Line 319 attempts `column.faceUpStart`, throwing `TypeError: Cannot read properties of null (reading 'faceUpStart')` or `reading 'cards'`.
   - Furthermore, in `evaluate` / `stockAction` / `freezeState`:
     - Calling `validateMove(state, { type: 'draw' })` on such a state also throws `TypeError: Cannot read properties of null (reading 'cards')` inside `freezeState`.
2. **Comparison with other engine functions**:
   - `isWon(state)` defensively checks `state.tableau.some((column) => !column || !Array.isArray(column.cards) ...)` and returns `false`.
   - `assertInvariants(state)` checks `column === null || typeof column !== 'object' || !Array.isArray(column.cards) || !isWhole(column.faceUpStart)` and throws `Error: invalid-state: column`.
   - `readSource` checks `!column || !Array.isArray(column.cards) || !isWhole(column.faceUpStart)` and returns `{ ok: false, reason: 'invalid-state' }`.
3. **Does this violate the documented API contract?**
   - **No.**
   - In `ARCHITECTURE.md` §3, the `GameState` data contract explicitly defines `tableau` as: *“Exactly seven `{ cards: CardId[], faceUpStart: integer }` columns.”* A structure with `tableau: [null, ...]` is not a valid `GameState`.
   - In `ARCHITECTURE.md` §5, `getLegalMoves(state) → Command[]` describes the function signature for game states.
   - In `TEST_PLAN.md` §2 (line 35), fuzzing requirements specifically mandate: *“Malformed command fuzz cases must include null, strings, arrays, negative/fractional/oversized indices and unknown pile/type names. Reject safely, without a thrown UI exception.”* Fuzzing of commands is fully implemented and tested.
   - `TEST_PLAN.md` §1 (line 12) states: *“All board fixtures contain exactly 52 cards: small piles under test plus valid supporting piles, never malformed boards accepted for convenience. Invalid-state fixtures are explicitly marked and tested only at validation boundaries.”*
   - Grok explicitly acknowledged this behavior in `.project/reports/T004.md` (line 42) and `.project/HANDOFF.md` (line 33): *“`getLegalMoves` assumes each tableau column has `cards` and `faceUpStart`, as move application does. An unreadable board returns `[]`. A null column can throw.”*
4. **Architectural assessment**:
   - While not a violation of the specification, `canReadBoard(state)` creates an asymmetric expectation: it guards against top-level non-objects or wrong array lengths (returning `[]`), but does not validate column objects or foundation array elements.
   - Deepening `canReadBoard(state)` to verify `state.tableau.every((col) => col && Array.isArray(col.cards) && isWhole(col.faceUpStart))` and `state.foundations.every((f) => Array.isArray(f))` would make `getLegalMoves` and `validateMove` return `[]` or `{ ok: false, reason: 'invalid-state' }` consistently for all malformed states.
   - This is classified as a **non-blocking improvement**, not a defect.

---

## Independent simulation results

An independent test harness simulated deterministic games across both draw modes:

- **Deals simulated**: 200 (100 deals in Draw 1, 100 deals in Draw 3; seeds 0–99).
- **Actions executed**: 40 000 legal actions (up to 200 actions per deal).
  - Draws: 11 798
  - Recycles: 1 123
  - Tableau & foundation transfers: 27 079
- **Invariant checks passed**: 40 200 (checked after initial deal and after every single action).
- **Enumeration checks passed**: 40 000 comparisons against independent candidate generator.
- **Failures / anomalies**: 0.

---

## Confirmed defects

### Blocking defects
- **None.**

### Non-blocking improvements / Defensive gaps
1. **Asymmetric board validation in `canReadBoard` (`src/engine/game.js`, lines 226–235)**:
   - `canReadBoard` checks top-level arrays but does not verify that `state.tableau[i]` contains `{ cards, faceUpStart }` or that `state.foundations[i]` is an array.
   - Deepening `canReadBoard` to validate column and foundation elements would prevent `TypeError` when `getLegalMoves` or `evaluate` is passed a partially malformed board object.
2. **Missing unit test for `getLegalMoves` on a won state**:
   - `tests/unit/game.test.js` tests blocked and near-win states (51 cards on foundation), but does not explicitly assert that a won board (52 cards on foundation) returns the 28 legal King return moves.

---

## Functionality intentionally deferred to later tasks

- **T005 (Session & Timeline)**: In-memory history timeline, Undo/Redo tracking, attempt accounting, statistics.
- **T014 (Hints & Polish feedback)**: Semantic hint ranking (uncover hidden > foundation advance > other transfer > draw/recycle), cycling through hints, and the Polish text “Brak dostępnego ruchu”.
- **T015+ (UI, Layout, Persistence)**: DOM rendering, Pointer Events, localStorage persistence, and service worker.

---

## Coverage results

```text
------------|---------|----------|---------|---------|-------------------
File        | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
------------|---------|----------|---------|---------|-------------------
All files   |   98.63 |    98.57 |     100 |     100 |
 src/engine |   98.63 |    98.57 |     100 |     100 |
  cards.js  |     100 |      100 |     100 |     100 |
  game.js   |   98.34 |    98.43 |     100 |     100 | 24,67,72,124
------------|---------|----------|---------|---------|-------------------
```

`TEST_PLAN.md` §7 requirements: ≥95% statements and ≥90% branches for `src/engine`.
Observed: **98.63% statements, 98.57% branches**. Requirements are fully satisfied. Uncovered lines (24, 67, 72, 124) are defensive edge-case branches carried over from T003.

---

## Final acceptance recommendation

### **ACCEPT**

No blocking defects exist. The implementation of T004 in commit `1073dfb1828dff1944713c616c9019cfcdc14056`:
- Strictly enforces Draw 1 and Draw 3 stock drawing and recycling rules according to `ARCHITECTURE.md` and `REQUIREMENTS.md`.
- Implements comprehensive, duplicate-free, deterministically ordered legal action enumeration in `getLegalMoves`.
- Fully preserves 52-card state invariants and strict immutability across 40 000 simulated moves.
- Meets all test and coverage thresholds (`npm test`, `npm run test:coverage`, `npm run build` all pass cleanly).
