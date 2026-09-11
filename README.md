# Sisu — a self-custodial, risk-bounded ETH/USDC book on Aqua + SwapVM

Sisu is a custom Aqua app: one 50/50 ETH/USDC strategy with an onchain risk cap.
Liquidity stays in the maker wallet; Aqua tracks virtual balances; SwapVM runs the
policy. Unsafe trades revert and no tokens move.

## Mechanism

Every swap executes one immutable program — `SISU_FEE → XYC → SISU_LIMIT`:

- **SisuFee (custom opcode 34)** — inventory-aware fee. Trades that worsen the
  50/50 balance pay more (up to `maxFee`); trades that repair it pay less
  (floor 0, never a rebate). Pressure × strength × normalized risk.
- **XYC** — the standard SwapVM constant-product step.
- **SisuLimit (custom opcode 35)** — the authoritative risk gate. Post-trade
  inventory imbalance `RiskPost = |A−B| / (A+B)` (USD values, ETH from the
  aggregator, USDC as $1) above `maxRisk` reverts with
  `SisuRiskLimitExceeded(post, max)`. Equality is allowed. The UI estimates;
  SwapVM enforces.

Maker story: ship once, earn more from flow that hurts your inventory and less
from flow that heals it — while the cap guarantees you can never be drained
past `maxRisk`. Trader story: one 50/50 book with a visible, enforceable
risk limit instead of opaque slippage.

Built on the official pinned contracts (`@1inch/swap-vm#b44977a`,
`@1inch/aqua#6f05aa1`); Sisu extends the opcode set, it does not fork SwapVM.

## Quickstart (judge path, ~3 minutes)

Terminal 1 — node:

```bash
cd sisu
npx hardhat node
```

Terminal 2 — seed (deploys, funds accounts 0 + 1, ships one 50/50 book):

```bash
npx hardhat run scripts/setup-ui.ts --network localhost
```

Terminal 3 — UI:

```bash
cd web
npm install
npm run dev      # http://localhost:3000
```

In MetaMask, import Hardhat account 1 (trader) and connect to
`http://127.0.0.1:8545` (chain 31337). Approve prompts appear in-UI when needed.

Headless proof of the same flow:

```bash
npx hardhat test                                   # 31 passing
npx hardhat run scripts/verify-trader.ts --network localhost
```

## Judging script

1. Connect account 1, open **Swap**. Dashboard shows the seeded 50/50 book.
2. **Safe swap** — 0.05 ETH → ~142 USDC settles. Risk rises. Hash lands in
   **History** as `settled`.
3. **Unsafe swap** — 5 ETH stays clickable, submits, and reverts:
   **Trade exceeds strategy risk limit** plus current / projected / max.
   No tokens move. History logs it as `reverted`.
4. **Repair swap** — swap back (USDC → ETH). It settles and risk falls;
   the fee is lower than the worsening direction.

## Example case (local seed: 1 ETH + 3000 USDC @ $3000, maxRisk 60%)

```text
safe quote:  in=0.05 ETH  out=142.448921274467781111 USDC
safe swap settled, trader ETH delta=-0.05
unsafe reverts as required: reverted with custom error
  'SisuRiskLimitExceeded(946525974, 600000000)'
unsafe swap reverted on send (no settlement)
maker balance unchanged: true
```

## Qualification checklist (1inch "Build an Aqua App")

- Official Aqua/SwapVM contracts used (pinned, extended — not forked).
- Onchain token transfers shown in the demo above (local node; public-network
  deployment tracked in `DEPLOYMENT_INFO.md`).
- Custom SwapVM instructions: `SisuFee` + `SisuLimit` with tests
  (`test/SisuRiskMath.test.ts`, `test/SisuAqua.e2e.test.ts`: safe / unsafe /
  repair / stale-oracle).
- Phased git history, one commit per completed step, never a final-day dump.

## Layout

```text
sisu/                       git root
├── contracts/              SisuFee, SisuLimit, SisuStrategy, SisuSwapVMRouter, libs
├── test/                   risk-math units + Aqua e2e (safe/unsafe/repair/stale)
├── deploy/                 deploy-sisu.ts (Sisu path) + deploy-aqua.ts (template)
├── scripts/                setup-ui.ts (seed), verify-trader.ts (headless proof)
├── web/                    Next.js UI — Dashboard / Strategy / Swap / History
└── DEPLOYMENT_INFO.md      networks, seed values, explorer links
```
