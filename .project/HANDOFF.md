# Fresh-session handoff

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, existing report in `reports/`, and dependency/status row in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect task-owned unfinished changes. Preserve unrelated dirty files.
4. Read the task's referenced root design/test sections and relevant [DECISIONS.md](DECISIONS.md). Do not rely on past chat context.
5. Perform only the assigned task, verify it, update report/status/handoff, commit with its ID and stop at REVIEW or a documented blocker.

## Current state and recent changes

- T000 DONE: eba965185ef8a60edf81f0318ab0fbf3481604f8.
- T001 DONE: accepted 2026-10-10. Implementation commit `339e0f852b60c691f52d6204aa7225b899c5844f`.
- T002 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation commit `d3c36f1df1d46d136e81d8c174f1636debed8a76`. Acceptance tracking commit: `2064a3da002e11209e463365c4d4a425980f5226`.
- T003 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `774b3e634e2b6991a91c4e24952b1919b0e4a484`. Accepted quality improvements `75070087cb4d49db1323467f8a7efb1737d325c0`. DOM-free `validateMove`, `applyMove`, `assertInvariants` and `isWon` in `src/engine/game.js`. Evidence: [reports/T003.md](reports/T003.md).
- Foundations use suit order trefl, karo, kier, pik. Tableau `cardIndex` starts the whole face-up suffix. A reveal is the newly exposed card id on that same move, or null. `isWon` requires four complete legal foundations and empty stock, waste and tableau.
- `assertInvariants` throws `invalid-state` for broken decks, face-up order and foundation contents. Move evaluation does not call it; tests and later restore do.
- Golden deals remain in `tests/fixtures/deals.json`. Hand-built boards are `tests/fixtures/boards.js`.
- T004 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `1073dfb1828dff1944713c616c9019cfcdc14056`. Independent review `2af3ee4fead49ceab3d9d3cc9143c69c568429f4`. Evidence: [reports/T004.md](reports/T004.md). Acceptance tracking for T003 is `70eee4ebedc27879b83087448b33de647c62e4f9`.
- Stock and waste are bottom at index 0. Draw pops the stock top onto the waste up to `drawCount` (1 or 3); a short stock moves only the remainder. Recycle reverses the remaining waste into the stock and does not draw. Example: stock `[D,C,B,A]` draw 3 → waste `[A,B,C]`, stock `[D]`. Recycle `[A,B,C]` → stock `[C,B,A]`. Played waste cards are absent from that stock.
- Failed draw/recycle preconditions return `illegal-source`. Extra command fields return `invalid-command`. `drawCount` other than 1 or 3 returns `invalid-state`. `unsupported-command` is no longer produced.
- `getLegalMoves` scan order is draw, recycle, tableau columns 0..6 and face-up `cardIndex` ascending, waste, foundations 0..3. Destinations are tableau 0..6 then foundation 0..3. T014 ranks this list by reveal, foundation, transfer, then draw/recycle while preserving scan order for ties. Empty legal list is not a loss.
- The page shell does not import the engine. No session, storage or Playwright.
- QA still open, not passed: browser console and visual/layout checks. GitHub Actions has not run on a remote runner. `filelist.txt` is absent; do not recreate it.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies.
- Resolve T003 implementation with `774b3e634e2b6991a91c4e24952b1919b0e4a484` and quality improvements with `75070087cb4d49db1323467f8a7efb1737d325c0`. Resolve T004 implementation with `1073dfb1828dff1944713c616c9019cfcdc14056`.
- T005 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `509fe7b911ce6d336bd55bfdc362778e93fd0cc1`. Evidence: [reports/T005.md](reports/T005.md). `scripts/run-simulation.mjs` runs the CI profile (seeds 0–999 in Draw 1 and Draw 3, plus seed 4294967295, at most 300 steps) through Vitest.
- T006 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `63b28ce3ee585ee8f243aca37e382e1f2f74983d`. `src/session.js` implements session timeline, Undo/Redo, snapshot caching, attempt restart, per-mode statistics, elapsedMs independence of Undo, and simulation extended to history operations. Evidence: [reports/T006.md](reports/T006.md).
- Passing CI counts, not a win rate: 2002 deals, 600427 steps, 3 wins, 0 stuck, 1999 step bounds. Categories: draw 222976, recycle 19046, tableau 166361, waste 14072, foundation 58227, invalid 119745. Won seeds: 827 Draw 1, 681 Draw 3, 888 Draw 3.
- T007 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a4b2f853598d6020caac4cd97938a7b8ff8b97d2`. `src/persistence.js` implements schema-v1 serialization, restore, pure-engine replay validation including redo tail, storage error and quota handling, byte retention on failure, defensive limits (1 MiB UTF-8, 10,000 commands), and simulation round trips. Evidence: [reports/T007.md](reports/T007.md). Acceptance tracking commit: `1249707`.
- T008 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `a1a7567`. `src/app.js` implements application controller connecting session timeline and persistence, active-time measurement via `performance.now()`, pause/dialog/visibility suppression, 5s checkpoints and `pagehide` saves, Web Locks single-writer ownership (`pl.solitaire.writer`) and storage revision conflict fallback. Playwright E2E infrastructure and tests in `tests/e2e/storage.spec.js`. Evidence: [reports/T008.md](reports/T008.md). Acceptance tracking commit: `b3f1a48`.
- T009 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `ae85d6b`. `src/ui/layout.js`, `src/ui/cards.js`, `src/ui/render.js`, `src/styles.css` implement responsive mobile-first board (320–430px portrait with zero horizontal scroll), SVG cards with >=14px corner ranks and >=24px exposed bands, N02 strict face-down card concealment, 2-column waste with Draw 3 fan, tableau scroller with 44px scroll handle and accessible buttons for long columns, and 44x44px bottom controls. Evidence: [reports/T009.md](reports/T009.md). Acceptance tracking commit: `ce965e0`.
- T010 original implementation DONE: accepted 2026-10-10 at `bdd275c`. Follow-up dialog-focus assertion revision accepted 2026-10-10 at `496f33f`: Playwright now waits for the first menu button to receive focus. Validation: 20 repeated focus checks, 123 unit tests, and 55 preview E2E tests passed. See [reports/T010.md](reports/T010.md).
- T011 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted implementation `fa1aa9c`. Polish game menu, New Game, Restart, Pause and Help dialogs implemented in `src/ui/dialogs.js`, with replacement confirmation on started unwon attempts (F05), pause concealment (F07), Draw 1 / Draw 3 toggle, Polish rules (N02), focus trap and restoration (N01 / T18), and full responsive support at 320px width and landscape (568x320). Evidence: [reports/T011.md](reports/T011.md). Acceptance tracking commit: `6610e7d`.
- T012 DONE: accepted by the human coordinator on 2026-10-10 at `916b3bd`; see [reports/T012.md](reports/T012.md).
- T013 DONE: physical checks on iPhone 15 and Android 12 found no problems; accepted 2026-10-10 at `916b3bd`. iOS/browser versions were not supplied; see [reports/T013.md](reports/T013.md).
- T014 DONE: accepted 2026-10-10 by the human coordinator at commit `6149f52`. Empty-action feedback and legal-hint ranking are implemented; the full preview suite passes. See [reports/T014.md](reports/T014.md).
- P1–P6 are complete. P7 is in progress.

## Blockers / next steps

- T009 and T010 follow-ups are accepted. Wait for an explicit T015 assignment.
- A user can play a complete game on mobile and desktop via tap, keyboard, and drag & drop.
- Current task: none. T009 and T010 follow-ups accepted 2026-10-10; T015 remains unassigned.
- Remote GitHub Actions CI has not run on a remote runner.
- `getLegalMoves` assumes tableau columns have `cards` and `faceUpStart`. A null column can throw. An unreadable board returns `[]`. The accepted review calls that non-blocking.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:e2e` (playwright test), `npm run test:coverage`, `npm run test:simulation -- --profile=ci`, `npm run build`. The release profile is `npm run test:simulation -- --profile=release` and is a T022 gate. See [README.md](../README.md).

Latest local results are in [reports/T014.md](reports/T014.md): `npm test` 123 passed across 9 files; `npm run test:e2e -- tests/e2e/play.spec.js` 12 passed in Chromium; `npm run build` exit 0 (JS bundle 73.66 kB, gzip 20.61 kB, CSS 11.97 kB, gzip 3.12 kB).

Before committing run `git diff --check` and `git diff --cached --check`. Do not report unexecuted browser, device or GitHub Actions checks as passed.

## T009 classical court artwork trial history (2026-10-10)

User approved the proposed classical J/Q/K illustrations and will review on their running development server. Twelve local public-domain SVG illustrations now replace letter badges. Card clipping follows SVG corner proportions and shadows are softer. See reports/T009.md. Status REVIEW; no deployment or push.

Latest T009 visual adjustment: enlarged J/Q/K illustration to 52x84 SVG units; upper index retained, lower duplicate omitted on court cards. Build and browser smoke checks passed; user review remains pending.

T009 latest refinement: user requested less space above court artwork; y moved from 50 to 44 SVG units. Build passed; awaiting visual review.

Latest T009 request: another approximately 1 CSS px upward nudge (SVG y=42), commit and push authorized. Build passed; user will review on iPhone.

## Follow-up acceptance (2026-10-10)

The human coordinator explicitly closed T009 and T010: “Zamykamy, wszystko działa!” Accepted T009 follow-ups through `ccc955641043bcbd68bba784b29bcaa2540a0b5c` and T010 focus-test correction `496f33f68320bfa2a639761888cb88434563157f`. Both are DONE; the historical review-pending notes above are superseded. No new device/browser version details were supplied. T015 remains TODO and unassigned.
