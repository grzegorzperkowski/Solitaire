# T028 — external LLM diagnostic handoff, 2026-10-15

REVIEW. Coordinator asked for the information and full new-algorithm code needed by the external LLM to diagnose the negative BFS results and propose improvements. Documentation and diagnostic delivery complete; acceptance pending.

Base 80039dd, master. Prior BFS results remain valid; no runtime changes assigned. Preserve both untracked solitaire-stan JSON files; no agents, branches or push.

Deliver a Polish paste-ready feedback document, full materialized FIFO source with engine dependencies and exact baseline queue, and a small reproducible diagnostic dataset. Probe the same stopped positions with both search orders to distinguish current search coverage from earlier whole-game decisions. Verify materialized source against the measured SHA256 and check engine replay/knowledge/history for every included position.

## Delivered

- `SMART_HINT_RND_FEEDBACK.md`: Polish paste-ready explanation of the isolated experiment versus the broader proposal, numeric budgets, whole-game and paired results, coverage/limitations, new same-position probes and focused questions. Requests at most two separately testable improvements and fair extra-work comparisons.
- `SMART_HINT_BFS_CODE.md`: complete materialized FIFO module, all four engine dependencies and standalone benchmark core, plus the exact baseline priority queue. Six source blocks, with relative paths and ES-module setup instructions. No duplicated full baseline module is needed: replacing the queue restores its exact source hash.
- `.project/reports/T028-bfs-diagnostics.json`: three engine-replayed trajectories with technical boards, player knowledge, first divergent commands, actual histories and both fresh-search results on the exact same position. Includes winning counterexample from FIFO's full-game result; no hidden-card values used for planning.

Source anchor is80039dd; baseline planner is2d1ecfc. The normalized materialized FIFO SHA256 is `48e390c7d62146352b9970a1efd892d7bc33895de252699b1ee99e43b212a785`, identical to all three measured benchmark summaries. Baseline restored from the supplied queue matches `d152efd1eabcd5278c410949ab2a0462fcbe8e527060393f6d2878eb31b486cb`.

## New observations

| Exact position | Baseline fresh search | FIFO fresh search |
| --- | --- | --- |
| seed203/Draw1, after47 FIFO commands, max512 | FOUND/REVEAL,25 commands,U93.5 | INCONCLUSIVE/LIMIT_REACHED,no goals |
| seed202/Draw1, after142 FIFO commands, max10000 | INCONCLUSIVE/LIMIT_REACHED,no goals | INCONCLUSIVE/LIMIT_REACHED,no goals |
| seed203/Draw3, after27 baseline commands, max512 | INCONCLUSIVE/LIMIT_REACHED,no goals | FOUND/FOUNDATION_ADVANCE,11 commands,U31 |

All probes rebuild actual knowledge and snapshots and omit previousHint for both algorithms. A full-game win on a different trajectory is not a win proof for the current board. The A/C reversal motivates asking about alternative-order coverage; a combined planner was neither implemented nor measured here.

## Actual verification

- `node .cache/T028-build-handoff.mjs`: exit0; three histories replayed with invariants, six fresh search results obtained, all nonempty plans legally replayed without information-boundary crossings. Code materialization checked against measured source hash. An initial diagnostic draft probed the completed FIFO win in the third case; revised it to probe the stopped baseline position, which supplies useful inverse evidence.
- `node .cache/T028-verify-handoff.mjs`: exit0, PASS. Extracted all six source blocks into a separate directory with type=module, reconstructed and hashed baseline, imported only extracted engine/benchmark sources, replayed all three positions/knowledge arrays and matched ALL SIX complete deterministic HintResults and independent plan effects exactly.
- `git diff --check`: exit0 before final staging. Final staged check and raw/summary consistency checks run before commit.

No runtime code changed. Full unit/build/E2E were not rerun for this artifact-only follow-up; previous367-test/build evidence belongs to80039dd. The extracted-source execution is fresh evidence of the supplied code package. No physical-device or speed claims.

## Resume

Give the external LLM the feedback file plus the code file and diagnostics JSON. No file was sent externally by the agent. Wait for coordinator assignment of an implementation experiment after feedback; no automatic successor. T028 stays REVIEW, not DONE. Both unrelated untracked diagnostics remain untouched. No branch, parallel agent, push or publication.
