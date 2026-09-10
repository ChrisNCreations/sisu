# Sisu

Git root is this directory. The parent `SIsu/` folder is not a repo.

**Frontend.** Before any UI, route, component, or `app/` work, read `docs/FRONTEND.md`.

**Major-step commit.** After a completed feature, fix, or build-order step (not WIP, not every file save):

1. Contract or test changes: `npx hardhat test` green.
2. `app/` changes: typecheck or `next build` in `app/`.
3. Spawn the `commit` agent (`.grok/agents/commit.md`).

Never push. Never commit `.env`, secrets, `node_modules`, `artifacts`, `cache`, `typechain-types`, `app/.next`.

WIP turns may stop with a dirty tree. Do not snapshot a half-step.
