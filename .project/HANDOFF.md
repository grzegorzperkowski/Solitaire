# Fresh-session handoff

## Resume protocol

1. Read [AGENTS.md](../AGENTS.md), [STATUS.md](STATUS.md) and this file.
2. Confirm the human's explicit task ID; read its specification in `tasks/`, its existing report in `reports/`, and the row/dependencies in [TASKS.md](TASKS.md). No assignment means stop and wait.
3. Run `git status --short`, `git branch --show-current`, `git log -5 --oneline`; inspect any task-owned unfinished diff. Preserve unrelated dirty files.
4. Read the task's referenced sections of the root design/test documents and relevant [DECISIONS.md](DECISIONS.md) entries. Do not infer project decisions from previous chat context.
5. Perform only the assigned task, verify it, update its report and status/handoff, commit with its ID, and stop at REVIEW or a documented blocker. Follow the approval rules in TASKS.md.

## Current state and recent changes

- T000 is ready for REVIEW; no implementation task is running. The same `master` branch is used by all models sequentially.
- Added lightweight status/task/handoff/decision files, concrete task specifications and the T000 report; AGENTS and the plan now enforce sequential assignments.
- Existing requirements, architecture and test strategy were preserved and added to Git because they had been untracked. No game source/configuration/dependency was created.
- Find the setup commit with `git log -1 --format="%h %s" --grep="^T000:"`. Reports refer to their containing commit rather than embedding a self-referential hash.

## Blockers / next steps

- Wait for T000 approval and an explicit T001 assignment. Record that approval with accepted commit/date/approver in reports/T000.md before starting T001; record the T001 assignment in its report.
- Preserve the unrelated untracked `filelist.txt`. Its contents are outside this task.
- Package tools and test suites do not exist yet. Physical-device availability and later publication permissions are coordinator inputs when their tasks are assigned.

## Test commands

Available now: `git diff --check`; before committing, `git diff --cached --check` and inspection of `git diff --cached --stat`. T000 also uses document-link/dependency/coverage checks described in its report.

After T001: `npm ci`, `npm run build`, `npm run dev` and `npm run preview` verify the shell. There are no game tests until T002. After each later task, use package.json scripts and that task's Required tests section as the source of truth.

Planned later: `npm test`, `npm run test:coverage`, `npm run test:simulation -- --profile=ci`, `npm run test:simulation -- --profile=release`, `npm run test:e2e`. Do not execute or report these as available until their owning tasks create them. Device checks are manual evidence, never assumed from Playwright results.
