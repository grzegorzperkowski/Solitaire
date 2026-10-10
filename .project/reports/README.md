# Task reports

Create `Txxx.md` when that task is assigned, not empty reports for the entire backlog. Append checkpoints and review feedback to the same report. Link to its spec; do not copy the specification.

Every report contains these sections:

- **Assignment:** task ID, date, explicit human assignment/scope, implementer/model if known, starting branch/commit and initial dirty paths. No invented model version or approval.
- **Work completed:** concrete outcomes and acceptance criteria met; separate unfinished work.
- **Files changed:** task-owned paths and purpose; list unrelated work left untouched.
- **Tests executed and results:** exact commands, exit/results and evidence paths where relevant; failures and tests not run with reasons. Document-only checks count only as document verification.
- **Remaining issues / resume instructions:** blockers, exact next action within this task, relevant fixtures/seeds and required human/device inputs. An interruption checkpoint must label unvalidated work clearly.
- **Git delivery:** checkpoint hashes already known; identify final delivery by its containing task-ID commit (`git log --oneline -- .project/reports/Txxx.md`). Do not amend a commit just to insert its own hash.
- **Coordinator acceptance:** pending until explicit approval; then record date, approver, accepted commit and the approval statement. REVIEW is not DONE. Requested revisions return the same task to IN_PROGRESS only when assigned.

Update TASKS.md, STATUS.md and HANDOFF.md in the same checkpoint when their state changes. Commit report/evidence with the work; stop after delivery.
