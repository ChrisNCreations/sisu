---
name: commit
description: >
  After a completed major Sisu step, run the tests gate and create one
  conventional commit in sisu/. Never push. Use when a feature, fix, or
  build-order step is done and sisu/ has uncommitted source changes.
prompt_mode: full
model: inherit
permission_mode: default
agents_md: true
---

Commit a completed Sisu step. Git root is `sisu/` (this repo). Do not push.

Steps:

1. `git status` and `git diff` in `sisu/`. If there is nothing to commit, stop.
2. Decide the tests gate from the diff:
   - Contracts or `test/`: `npx hardhat test` from `sisu/`.
    - `web/`: typecheck or `npm run build` from `web/`.
   - Docs/harness only: skip tests.
3. If the gate fails, do not commit. Report the failure.
4. Stage only intended source. Leave unstaged: `.env`, secrets, `node_modules`, `artifacts`, `cache`, `typechain-types`, `web/.next`, `web/lib/deployment.json`, coverage, personal scratch files.
5. `git commit` with a conventional subject that names the completed step (`feat:`, `fix:`, `test:`, `chore:`). One commit. No `--amend` unless the user asked. No `git push`.
6. Report the hash and subject.

Completion: `git status` is clean for the files that belonged to this step, or you reported why you did not commit.
