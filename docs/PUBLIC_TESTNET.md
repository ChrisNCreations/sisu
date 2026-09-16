# Public Sepolia product — agent brief

Locked 2026-09-16. Hand this to any coding agent. It supersedes the hackathon demo contract and the “one canonical book, hide `/strategy`” parts of `../docs/TESTNET_PLAN.md`.

Git root is this directory. The parent workspace folder is not a git repo. Do not push unless the operator asks. Never commit `.env`, private keys, `web/lib/deployment.json`, artifacts, cache, typechain, or `.next`.

## Read first

1. `../CONTEXT.md` — language. Use those words. Do not invent synonyms.
2. `../docs/STATUS.md` — live state.
3. `AGENTS.md` then `../docs/specs/backend.md` / `../docs/specs/frontend.md` / `../docs/specs/build.md`.
4. `docs/FRONTEND.md` before any UI work.
5. This file.

After each completed slice, update `../docs/STATUS.md`, `README.md`, and `DEPLOYMENT_INFO.md`. Keep the 2026-09-11 TokenMock Sepolia seed as history, not live.

---

## Vision

Sisu was a judged Hardhat demo. It is now a **public Sepolia product**.

A stranger with MetaMask on Sepolia must be able to wrap ETH, get Circle USDC from a faucet, approve, quote, and swap against a live 50/50 ETH/USDC book. They may also ship their own book. **Nothing in that path is a Sisu-deployed mock.**

The protocol does not change:

- Self-custodial: tokens stay in the maker wallet; Aqua tracks virtual balances.
- Program: `SISU_FEE → XYC → SISU_LIMIT`.
- `RiskPost > MaxRisk` reverts, no settlement. Equality is allowed.
- UI estimates. SwapVM enforces. Frontend cannot bypass Limit.

Local Hardhat mocks remain for tests and `npm run seed:local` only.

---

## Product contract

| Decision | Value |
|----------|--------|
| Network | Ethereum Sepolia, chain id `11155111`. Not Base Sepolia. Not mainnet. |
| Pair | One frozen ETH/USDC pair for every book. |
| ETH leg | Canonical Sepolia WETH (ERC-20). Native ETH is gas + wrap only. Aqua still settles ERC-20. |
| Stable leg | Circle official Sepolia USDC. Not a Sisu `TokenMock`. |
| Mark | Live Chainlink ETH/USD AggregatorV3. Not `MockAggregatorV3`. |
| Makers | Any connected wallet may ship a 50/50 book. `/strategy` stays in the public nav. |
| Traders | Any connected wallet may swap against a chosen book. |
| Featured book | Operator seeds and funds **one** book so a stranger has liquidity on day one. |
| Other books | Open via a **shareable link that carries the full order** `{maker, traits, data}`. Show the strategy hash. Hash-only is not enough: SwapVM needs the order; Aqua does not return the order from the hash. |
| Indexer / API | Out (`../docs/adr/0004-no-indexer.md`). History is this-browser `localStorage`, labeled as such. |
| Public UI mocks | Out. No `mock.ts` book on a public build. No silent localhost RPC. |
| Wallet | Injected only (wagmi). No WalletConnect / RainbowKit in v1. |

### Proposed pair freeze — verify on-chain before writing `.env`

These are **candidates**, not yet locked. `eth_call` decimals, symbol, and `latestRoundData()` on Sepolia. Fail if anything is missing, stale, or non-positive.

| Asset | Source | Address | Expected decimals |
|-------|--------|---------|-------------------|
| WETH | Uniswap Sepolia WETH9 | `0xfff9976782d46cc05630d1f6ebab18b2324d6b14` | 18 |
| USDC | Circle Sepolia USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | 6 |
| Oracle | Chainlink ETH/USD Sepolia | `0x694AA1769357215DE4FAC081bf1f309aDC325306` | 8 |

- Circle faucet: https://faucet.circle.com — testnet USDC has **no dollar backing**.
- Staleness: read a live round; set `SISU_ORACLE_MAX_STALENESS` to 2× observed heartbeat (or documented Chainlink heartbeat), fail closed if stale.
- If verification fails, **stop**. Do not invent a faucet token or deploy `TokenMock` / `MockAggregatorV3` on Sepolia.

Retire as live: 2026-09-11 judged seed in `DEPLOYMENT_INFO.md` (mock ETH/USDC/oracle, maker = trader). Keep the table as historical.

---

## Public user journeys

1. Open the public URL. Wallet on the wrong chain → explain mismatch; do not send txs.
2. Wrap native ETH → WETH in the product before a WETH-side trade.
3. Obtain Circle USDC from the faucet (docs + link; Sisu does not mint).
4. Approve Aqua/router as required (connected wallet).
5. Quote + swap on the featured book, or open another book from a share link.
6. Unsafe size stays clickable. On revert show **Trade exceeds strategy risk limit** plus current / RiskPost / max. Explorer link. No tokens moved.
7. Optional: ship their own 50/50 book (`/strategy`) with WETH + USDC they hold. Share the resulting order link.

---

## Kill list (remaining mocks / demo assumptions)

| Today | Public bar |
|-------|------------|
| `web/lib/sdk/mock.ts` when unseeded | Public build: empty/error. Never a fake book. |
| Unseeded chain fallback `31337` / `localhost:8545` | Public build is Sepolia-only. |
| `error.tsx` “start Hardhat” | Copy follows the manifest network. |
| `tokenMeta` / oracle `?? 18` / `?? 8` | Fail closed on Sepolia if `tokens` / `oracle` missing. |
| Native ETH on the pill, no wrap | In-product WETH `deposit()`. |
| `getBalances` reads **maker** only | Also read **connected wallet** WETH/USDC; insufficient-funds gate. |
| Explorer hardcoded by chain id | Use `explorerBaseUrl` from the manifest. |
| One `deployment.json` order only | Featured order in the manifest; other orders from the share link. |
| Ship treats connected wallet as a new maker against the seeded book without making that explicit | Ship creates **that wallet’s** book. Swap against featured or opened order. Distinct roles. |

`deploy/deploy-sisu.ts` already refuses mocks on non-local networks. Keep that invariant. `deploy/deploy-aqua.ts` (AquaAMM template) is not the product path.

---

## Out of v1

Indexer, backend API, registry contract, published SDK, WalletConnect, mobile, light mode, extra pairs, native-ETH settlement, browsable `eth_getLogs` directory (later), mainnet, encouraging real-value deposits.

Testnet liquidity is experimental. Docs must say so.

---

## Implementation slices (do in order)

Each slice is one conventional commit in this repo after its gate.

- Contracts or `test/`: `npx hardhat test` from this directory.
- `web/`: `npm run build` from `web/`.
- Then the commit agent (`.grok/agents/commit.md`) or equivalent. Never push unless asked.

### Slice 1 — Freeze assets

- On-chain verify the three candidate addresses (bytecode, decimals, symbols, fresh positive oracle round).
- Write verified values into `.env.example` as comments and into `DEPLOYMENT_INFO.md` as “intended public pair (unseeded until slice 2)”.
- Do not broadcast.

**Done when:** a later agent can fill `SISU_WETH_ADDRESS` / `SISU_USDC_ADDRESS` / `SISU_ORACLE_ADDRESS` from docs without guessing.

### Slice 2 — Deploy featured book (no mocks)

- `npm run deploy:sisu:sepolia` with `SISU_ALLOW_LIVE_DEPLOYMENT=true` and the frozen assets.
- Distinct `SISU_MAKER_PRIVATE_KEY` (not the trader). Maker holds WETH + Circle USDC, approves Aqua, ships one 50/50 book.
- `npm run validate:deployment:sepolia`.
- Verify SisuStrategy + router on Etherscan (hardhat-verify built-in v2; do not re-add a Sepolia `customChains` entry).
- `scripts/verify-trader.ts` with a **different** trader key: safe swap settles, unsafe reverts, balances unchanged.
- Write `web/lib/deployment.json` locally (gitignored). Publish addresses + strategy hash + order in `DEPLOYMENT_INFO.md`.

**Done when:** Etherscan shows verified Sisu contracts, Circle USDC and Uniswap WETH (not TokenMock), and a two-key smoke receipt.

### Slice 3 — Public client

- Sepolia when the manifest `chainId` is `11155111`. No localhost fallback in a public build.
- Chain-mismatch copy. Wrap WETH. Connected-wallet balances + allowance + insufficient funds.
- Fail closed on missing manifest decimals.
- Shareable order URL for non-featured books.
- `/strategy` ships from the connected wallet; does not pretend to be the featured maker.
- `mock.ts` unused in production builds.
- Unsafe swap still “Swap anyway”; Limit copy unchanged.

**Done when:** a seeded public build never shows mock inventory, can wrap/approve/swap, and can open a second book from a link.

### Slice 4 — Docs and retirement

- README judge path stays **local** (`npm run seed:local`).
- Public path: faucet, wrap, featured book, how to ship, how to share, experimental disclaimer.
- STATUS next-slice updated. 2026-09-11 mock seed labeled historical.

**Done when:** a new agent can operate the public book from README alone.

---

## Success

A person who is not on the team opens the public URL, connects a Sepolia wallet, wraps ETH, faucets USDC, swaps on the featured book, hits the cap, sees the revert on Etherscan, and can ship their own book — with no Sisu mocks in that path.
