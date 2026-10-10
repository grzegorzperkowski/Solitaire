# Fresh-session handoff

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, existing report in `reports/`, and dependency/status row in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect task-owned unfinished changes. Preserve unrelated dirty files.
4. Read the task's referenced root design/test sections and relevant [DECISIONS.md](DECISIONS.md). Do not rely on past chat context.
5. Perform only the assigned task, verify it, update report/status/handoff, commit with its ID and stop at REVIEW or a documented blocker.

## Current state and recent changes

- T000 DONE: coordinators authorized acceptance subject to verification, which passed for eba965185ef8a60edf81f0318ab0fbf3481604f8; see reports/T000.md.
- T001 DONE: accepted 2026-10-10 by the human coordinator and ChatGPT. Accepted commit `339e0f852b60c691f52d6204aa7225b899c5844f`. Minimal Polish page, semantic HTML, responsive CSS and an ES module importing CSS. No cards, rules, interactions, storage or Playwright in that commit.
- QA exception: browser console and visual checks are outstanding. Closure tried browser automation; the daemon did not start because remote debugging is off. Those checks are waived as a T001 gate and are not passed. HTTP smokes and Node tests remain the recorded evidence.
- Node 22.22.0 / npm 10.9.4; Vite 8.3.4, Vitest and coverage-v8 5.0.3. Zero runtime dependencies; lockfile committed. Details in [reports/T001.md](reports/T001.md).
- Relative Vite base (`./`) is the bootstrap default. Deployment, manifest and worker work remain later tasks.
- Resolve T001 delivery with `git log -1 --format="%h %s" --grep="^T001:"`. Reports do not embed their own commit hash. The acceptance commit is the implementation commit above; the tracking commit that records DONE is separate.
- T002 is assigned by the same 2026-10-10 coordinator instruction. It is not started in the acceptance commit. T003 is not assigned.

## Blockers / next steps

- Implement T002 only: [tasks/T002.md](tasks/T002.md). Dependencies T000 and T001 are DONE.
- Browser console and rendered layout at 320px and desktop remain outstanding QA from T001.
- `filelist.txt` was not in the tree at T001 closure. Do not invent or recreate it.
- Bootstrap tests verify HTML/module wiring, not engine rules or browser behavior. Coverage reports zero statements until engine modules exist.

## Test commands

Available now: `npm ci`, `npm test` (vitest run, non-watch), `npm run test:coverage`, `npm run build`. See [README.md](../README.md) for dev/preview and repository-subpath checks.

Verified during T001: `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` and `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`, plus an explicit `/Solitaire/` base. Stop servers after testing.

Before committing run `git diff --check` and `git diff --cached --check`. Simulation/E2E scripts do not exist until their assigned tasks create them. Do not report unexecuted browser/device checks as passed.
