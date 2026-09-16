# Sisu

Git root is this directory. The parent `SIsu/` folder is not a repo.

**Language.** `../CONTEXT.md`

**Map / status.** `../docs/README.md`, `../docs/STATUS.md`

**Frontend.** Canonical UI is `web/`. Before any UI, route, or component work, read `docs/FRONTEND.md` then `../docs/specs/frontend.md`.

**Protocol.** Before contract or test work, read `../docs/specs/backend.md`.

**Build / seed / demo.** `../docs/specs/build.md`

**Public Sepolia product.** `docs/PUBLIC_TESTNET.md` — no Sisu mocks on a public network; featured book + any maker may ship.

**Major-step commit.** After a completed feature, fix, or build-order step (not WIP, not every file save):

1. Contract or test changes: `npx hardhat test` green.
2. `web/` changes: `npm run build` in `web/`.
3. Spawn the `commit` agent (`.grok/agents/commit.md`).

Never push. Never commit `.env`, secrets, `node_modules`, `artifacts`, `cache`, `typechain-types`, `web/.next`, `web/lib/deployment.json`.

WIP turns may stop with a dirty tree. Do not snapshot a half-step.
