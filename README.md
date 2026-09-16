# SISU

**Ship a book. Cap the risk.**

A self-custodial, risk-bounded ETH/USDC book on Aqua + SwapVM. Liquidity stays in the maker wallet. Aqua tracks virtual balances. SwapVM runs the policy. Unsafe trades revert; tokens do not move.

Landing page at `/` leads into the app at `/dashboard`, `/strategy`, `/swap`, `/history`.

---

## Product concept

Sisu is one 50/50 ETH/USDC strategy with an onchain risk cap — not a DEX, aggregator, or pool suite.

- **Maker** ships the strategy once. Tokens stay in the maker wallet; Aqua holds virtual balances.
- **Trader** swaps against the shipped strategy.
- **Inventory** is valued in USD: ETH from the aggregator, USDC as $1 (**Mark**).
- **Risk** is inventory imbalance `|A−B| / (A+B)` on USD values. Zero inventory is zero risk.
- **MaxRisk** is the hard cap. `RiskPost > MaxRisk` reverts. Equality is allowed.
- **Fee** is inventory-aware: worsening 50/50 pays more, repairing pays less, floor 0, never a rebate.

Maker story: earn more from flow that hurts your inventory and less from flow that heals it — while the cap guarantees the book can never drain past `maxRisk`. Trader story: one visible book with an enforceable limit instead of opaque slippage.

## Why this only works on Aqua + SwapVM

AMM trading today splits custody (pools hold your tokens), policy (fees and limits live in offchain docs or governance), and enforcement (the UI warns, the chain shrugs). The "risk-managed" book is leashed to a trusted middleman at every step.

Aqua + SwapVM are different. Aqua settles self-custodially with virtual balances and atomic pull/push, so the maker wallet stays the vault. SwapVM executes the strategy's own bytecode on every swap, so the policy is not a suggestion — it is the execution path. Sisu extends the opcode set; it does not fork SwapVM.

That is the wedge: fee, price, and risk gate run as one immutable program the frontend can quote but never bypass.

Built on the pinned contracts (`@1inch/swap-vm#b44977a`, `@1inch/aqua#6f05aa1`).

## Architecture

```text
Maker                    Aqua / SwapVM                      Trader
  |                            |                               |
  | ship 50/50 strategy        |                               |
  |--------------------------> | SisuStrategy.buildProgram     |
  |                            | SISU_FEE -> XYC -> SISU_LIMIT  |
  |                            | virtual balances               |
  |                            |                               | quote (eth_call)
  |                            | SisuFee (opcode 34)            |<-
  |                            | XYC (standard step)            | swap
  |                            | SisuLimit (opcode 35)          |->
  |                            | settle OR revert, no partial   |
```

Solid arrows: transactions. Quote path: `eth_call` of the same program — display only.

## How it works

1. **Ship** — Maker approves Aqua, calls `SisuStrategy.buildProgram` (50/50, no `targetWeight`), ships one book with `maxRisk`, `baseFee`, `maxFee`, `rebalanceStrength`.
2. **Quote** — UI runs `eth_call` of the real program: amount out, fee, current risk, RiskPost, and whether Limit would pass. `canExecute` means "would Limit pass", not a second model.
3. **Swap** — Trader swaps via `SisuSwapVMRouter`. `SisuFee` runs before XYC so Limit sees net `amountIn`. `SisuLimit` runs after XYC when `amountOut` is known.
4. **Revert** — If `RiskPost > maxRisk`, the swap reverts with `SisuRiskLimitExceeded(post, max)`. No tokens move. The UI stays clickable and shows **Trade exceeds strategy risk limit** plus current / projected / max.
5. **Repair** — Swaps back toward 50/50 settle, lower risk, and pay a lower fee than the worsening direction.
6. **Dock** — Maker closes the strategy so it no longer fills.

## Autonomy model

No keeper, no server, no indexer. There is nothing to poke: every rule is checked inside the swap itself.

- Offchain components calculate and display. Onchain components enforce.
- Frontend numbers do not affect settlement. Aqua pull/push stay atomic with the VM run.
- `RiskPost > MaxRisk` ⇒ revert, no settlement. `RiskPost == MaxRisk` ⇒ allow.
- Stale, incomplete, or non-positive oracle marks revert instead of pricing.
- History is the browser's own `localStorage` log. No backend by design (ADR-0004).

## Deployed contracts

| Contract | Address | Explorer |
|----------|---------|----------|
| Aqua | `0x3C79789Fc773962803d61115ee13DCa0b011D22f` | https://sepolia.etherscan.io/address/0x3C79789Fc773962803d61115ee13DCa0b011D22f |
| SisuStrategy | `0xCFDE9b3868A08eEAbBbC803a3f126BEa471E8bC9` | https://sepolia.etherscan.io/address/0xCFDE9b3868A08eEAbBbC803a3f126BEa471E8bC9 |
| SisuSwapVMRouter | `0xD2e8bA0284a1f19a33168e805F905084444c13d2` | https://sepolia.etherscan.io/address/0xD2e8bA0284a1f19a33168e805F905084444c13d2 |
| ETH (mock) | `0x830e9bccFd31cc2E19CA7ae5cfD061D268399f3c` | https://sepolia.etherscan.io/address/0x830e9bccFd31cc2E19CA7ae5cfD061D268399f3c |
| USDC (mock) | `0xBB161a52382494c4aF1C9b3b07d4Ff4Bfc0A3A5B` | https://sepolia.etherscan.io/address/0xBB161a52382494c4aF1C9b3b07d4Ff4Bfc0A3A5B |
| ETH/USD mark (mock) | `0x662CA6e79F4d0d95fFA1F42b4fc79a624AED8D27` | https://sepolia.etherscan.io/address/0x662CA6e79F4d0d95fFA1F42b4fc79a624AED8D27 |

Seeded 2026-09-11 on Sepolia (chain 11155111), same policy as local: 1 ETH + 3000 USDC @ $3000, maxRisk 60% (`6e8`), baseFee 30 bps, maxFee 100 bps, strength `1e9`. Strategy:

`0x52c63c3e302c68bd1050795353a111c7b650800330aa56511aeae7eb41f8e12c`

Router creation tx: https://sepolia.etherscan.io/tx/0x151d66e13e2df09c3bfbbdf319f2545aeab966312bd13be598f22fcbf04fa56f

All three product contracts show green source ticks (Aqua matched 1inch's verified bytecode; Strategy + Router verified via `scripts/verify-etherscan.ts`, solc 0.8.30, optimizer runs 1, Cancun). Full address table: `DEPLOYMENT_INFO.md`.

That 2026-09-11 seed is a **judged mock-asset** deployment (mock ETH, mock USDC, mock mark). It is not the supported public path. `npm run deploy:sisu:sepolia` never deploys mocks; it consumes configured `SISU_WETH_ADDRESS`, `SISU_USDC_ADDRESS`, and `SISU_ORACLE_ADDRESS`. See `.env.example`. Testnet liquidity is experimental — do not deposit valuable assets.

To run the UI against a seed, copy the written manifest into `web/lib/deployment.json` (gitignored) and rebuild `web/`. Chain id and RPC follow that manifest.

## On-chain proof

Local seed (1 ETH + 3000 USDC @ $3000, maxRisk 60%) and Sepolia say the same thing:

```text
safe quote:  in=0.05 ETH  out=142.448921274467781111 USDC
safe swap settled, trader ETH delta=-0.05
unsafe reverts as required: reverted with custom error
  'SisuRiskLimitExceeded(946525974, 600000000)'
unsafe swap reverted on send (no settlement)
maker balance unchanged: true
```

Proven in e2e (`test/SisuAqua.e2e.test.ts`): safe trade raises risk and settles; unsafe trade reverts and does not settle; repairing trade succeeds; stale mark reverts; an exact-out swap settles and charges the fee on top of the XYC input; a repairing swap pays a strictly lower fee than a worsening swap at the same state. Headless verifier: `scripts/verify-trader.ts`.

The Sepolia deployment is a **liveness and deployment** proof, not the security proof: maker and trader are the same EOA there, so "no tokens moved" is near-vacuous on-chain. The unsafe-revert / no-settlement property is proven by the local two-account e2e suite and `scripts/verify-trader.ts` on a local node. Weigh those over the Sepolia receipts.

## Quickstart (judge path, ~3 minutes)

From this directory (`sisu/`).

Terminal 1 — node:

```bash
npx hardhat node
```

Terminal 2 — seed (deploys local mocks, funds accounts 0 + 1, ships one 50/50 book, writes `web/lib/deployment.json`):

```bash
npm run seed:local
```

Terminal 3 — UI:

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

Open `/` (landing), then **Launch App** to `/dashboard`. In MetaMask, import Hardhat account 1 (trader) and connect to `http://127.0.0.1:8545` (chain 31337). The header **Connect** button names the installed injected wallet (EIP-6963). Approve prompts appear in-UI when needed.

Headless proof of the same flow:

```bash
npx hardhat test
npx hardhat run scripts/verify-trader.ts --network localhost
```

Product deploy (not required for the judge path): `npm run deploy:sisu:local` then `npm run validate:deployment:local`. Sepolia deploy needs the `SISU_*` env vars in `.env.example` and never deploys mocks.

## Judging script

1. Open `/`, click **Launch App**. `/dashboard` shows the seeded 50/50 book.
2. **Safe swap** — Connect account 1, open **Swap**. 0.05 ETH → ~142 USDC settles. Risk rises. Hash lands in **History** as `settled`.
3. **Unsafe swap** — 5 ETH stays clickable, submits, and reverts: **Trade exceeds strategy risk limit** plus current / projected / max. No tokens move. History logs it as `reverted`.
4. **Repair swap** — swap back (USDC → ETH). It settles and risk falls; the fee is lower than the worsening direction.

The local seed is the judging surface. A public Sepolia build still needs a WETH wrap step, a wallet chain-mismatch explanation, and connected-wallet faucet-balance gates (`docs/STATUS.md`). Unseeded `web/` falls back to the mock SDK.

## Stack

| Layer | Choice |
|-------|--------|
| Contracts | Solidity 0.8.30, Cancun, viaIR, optimizer runs 1 |
| Build / test | Hardhat 2.22, hardhat-deploy |
| Chain client | viem 2.x, wagmi injected only. Chain id and RPC come from the seed manifest (Hardhat `31337` or Sepolia `11155111`). Named Connect CTA via EIP-6963; connected pill copies, links the explorer, and disconnects. |
| Frontend | Next.js 16 App Router, TypeScript, Tailwind v4, recharts (one allocation split). Compact top bar — no command palette. |
| Onchain UI | `web/lib/sdk/real.ts` when `web/lib/deployment.json` is present (quote, ship, swap, dock, revert decode, manifest decimals). `mock.ts` fallback without a seed. |
| Landing | Static `web/app/page.tsx` — no wallet, no SDK, no seed needed |
| App | `web/app/(app)/` — Dashboard `/dashboard`, Strategy `/strategy`, Swap `/swap`, History `/history` |
| Settlement | Aqua (virtual balances) + SwapVM (`SISU_FEE` opcode 34, `SISU_LIMIT` opcode 35) |

## Security

| Layer | Mechanism | Enforcement |
|-------|-----------|-------------|
| Risk gate | `RiskPost > maxRisk` reverts, equality allowed | `SisuLimit` after XYC |
| Fee ordering | Fee must run before swap so Limit sees net `amountIn` | `SisuFeeMustRunBeforeSwap`, `runLoop` |
| Fee bounds | Floor 0, cap `maxFee`, never a rebate | `SisuRiskMath.finalFee` clamp |
| Policy sanity | Zero max risk, fee inversion, fee above 100%, and non-ETH/stable pairs rejected | `ZeroMaxRisk`, `MaxFeeBelowBaseFee`, `MaxFeeAboveBps`, `UnsupportedPair` |
| Oracle | Stale / incomplete / non-positive marks revert | `SisuStaleOracle`, `SisuIncompleteOracleRound`, `SisuInvalidOraclePrice` |
| Valuation | ETH via aggregator, USDC (non-ETH leg) as $1 — enforced ETH/stable scope | `SisuValuation.sideValue`, `SisuStrategy.buildProgram` |
| Settlement | Pull/push atomic with the VM run | Aqua + router |
| UI boundary | Quote is `eth_call` display only | SwapVM is authoritative; frontend cannot bypass Limit |

## Competitive landscape

| | Self-custody | Onchain risk cap | Inventory-aware fee | One-book UX |
|---|---|---|---|---|
| Generic XYC AMM | — (pool holds tokens) | — (opaque slippage) | — (flat fee) | — |
| AquaAMM template | Partial (Aqua settlement) | — | Partial (flat/protocol/decay) | — |
| **Sisu** | **Yes (maker wallet + virtual balances)** | **Yes (`SisuLimit`, equality allowed)** | **Yes (`SisuFee`, floor 0)** | **Yes (Dashboard / Swap / History)** |

## Built on

- [1inch Aqua](https://github.com/1inch/aqua) (`#6f05aa1`) — self-custodial settlement: ship, dock, pull, push, virtual balances
- [1inch SwapVM](https://github.com/1inch/swap-vm) (`#b44977a`) — instruction VM Sisu extends with opcodes 34/35, not a fork
- Chainlink aggregator pattern — ETH/USD mark with staleness guard (`MockAggregatorV3` locally)

## Contributing

PRs welcome. Phased git history, one commit per completed step, never a final-day dump.

1. Contract or test changes: `npx hardhat test` green from `sisu/`.
2. `web/` changes: `npm run build` from `sisu/web/`.
3. After a completed feature, fix, or build-order step, spawn the `commit` agent (`.grok/agents/commit.md`). Never push. Never commit `.env`, secrets, `node_modules`, `artifacts`, `cache`, `typechain-types`, `web/.next`, `web/lib/deployment.json`.

Language: `../CONTEXT.md`. Map: `../docs/README.md`. Status: `../docs/STATUS.md`. Frontend rules: `docs/FRONTEND.md` then `../docs/specs/frontend.md`. Protocol: `../docs/specs/backend.md`. Build: `../docs/specs/build.md`.

## License

This repository builds on 1inch's SwapVM template and is distributed under the terms in `LICENSE` (`LicenseRef-Degensoft-SwapVM-1.1`). Incorporated third-party components are listed in `THIRD_PARTY_NOTICES` and `LICENSES/`.

## Appendix: layout

```text
sisu/                       git root
├── contracts/              SisuFee, SisuLimit, SisuStrategy, SisuSwapVMRouter, libs
├── test/                   risk-math units + Aqua e2e + deploy-config
├── deploy/                 deploy-sisu.ts (Sisu path) + deploy-aqua.ts (template)
├── deploy-entrypoints/     hardhat-deploy loaders (paths.deploy)
├── scripts/                setup-ui.ts (seed), validate-deployment.ts, verify-trader.ts
├── web/                    Next.js UI — landing / + app /dashboard /strategy /swap /history
└── DEPLOYMENT_INFO.md      networks, seed values, explorer links
```

## Appendix: qualification checklist (1inch "Build an Aqua App")

- Official Aqua/SwapVM contracts used (pinned, extended — not forked).
- Onchain token transfers shown in the demo above: local script plus the Sepolia deployment with explorer links (`DEPLOYMENT_INFO.md`).
- Custom SwapVM instructions: `SisuFee` + `SisuLimit` with tests (`test/SisuRiskMath.test.ts`, `test/SisuAqua.e2e.test.ts`: safe / unsafe / repair / stale-oracle).
- Phased git history, one commit per completed step, never a final-day dump.
