# Sisu frontend

Canonical UI context. Read this before any `web/` work. Protocol math lives in the contracts and the architecture grill; this file is the product surface only.

**Location.** The implemented app is `sisu/web/`, inside the git root (moved 2026-09-11; supersedes ADR-0003). Remaining UI work: `../docs/specs/frontend.md` at the workspace root.

## Product the UI must make obvious

Sisu is a self-custodial, risk-bounded XYC book on Aqua/SwapVM.

- LP (Hardhat account 0) ships a 50/50 ETH/USDC strategy. Tokens stay in the maker wallet; Aqua holds virtual balances.
- Trader (Hardhat account 1) swaps against it.
- Inventory is valued in USD (ETH/USD aggregator, USDC = $1).
- After every trade: `RiskPost = |A−B| / (A+B)`. If `RiskPost > maxRisk`, the swap reverts. No tokens move.
- Fees: trades that worsen 50/50 pay more; trades that repair it pay less, floor 0, never a rebate.
- The UI estimates. SwapVM enforces. `app/lib` cannot bypass the limit.

Hackathon win: custom opcodes, visible onchain transfers, git history that is not a final-day dump, judge-visible revert **Trade exceeds strategy risk limit**.

## Users and accounts

| Role | Account | Routes |
|------|---------|--------|
| LP / maker | Hardhat #0 | Dashboard, Create, Dock |
| Trader / taker | Hardhat #1 | Swap (and History of their txs) |

Switch in MetaMask. Demo funds both. Do not require one EOA to be both.

## Stack

- Next.js App Router at `sisu/web/`
- TypeScript, Tailwind v4 using `sisu/design/theme.css` + `variables.css`
- wagmi + viem, injected wallet only, chain Hardhat `31337`
- recharts for **one** Dashboard allocation split
- React Bits only for decorative/motion that does not fight tokens
- Core UI hand-built from tokens. No Linear sidebar, command palette, or issue-tracker chrome
- Quote / ship / swap / dock / decode live in `sisu/web/lib`, not a published SDK
- Desktop-first. Dark only.

## Visual

Linear tokens and density, Sisu layout.

- Canvas Void `#08090a`, cards Carbon/Obsidian, hairline Graphite borders
- One acid-lime CTA per view (`#e4f222`)
- Inter for UI, Berkeley Mono (or JetBrains Mono) for hashes, bps, percents
- Weights 400–590. Compact 4px spacing. Radii 6px controls / 12px cards
- Pulse green is never a status color. Coral red is reserved as the sole over-limit signal (gauge fill + alert copy). Risk uses the gauge + copy.

## Routes

Compact top nav: Dashboard · Create · Swap · History · Connect.

| Route | Job |
|-------|-----|
| `/` Dashboard | Home. Seeded strategy state. Allocation chart. Risk gauge. Virtual vs wallet. Dock. |
| `/strategy/create` | LP ships a 50/50 book. Not a gate for Swap. |
| `/swap` | Judging surface. Quote + clickable unsafe swap. |
| `/history` | Local/session tx log. No indexer. |

README tells judges: connect account 1, open Swap, run safe / unsafe / repair.

## Dashboard

- Pair ETH / USDC
- Total value (USD)
- Allocation % (ETH vs USDC by USD)
- One recharts two-segment ETH/USDC allocation split (not a risk time series)
- Risk current / max as a RiskGauge bar
- Current fee (bps)
- Max trade (derived hint, not an opcode)
- Virtual balances vs maker wallet balances
- Dock (not on the judging critical path)

## Create

Pair locked ETH/USDC. Collect:

- Deposit amount ETH
- Deposit amount USDC
- `maxRisk`, `baseFee`, `maxFee`, `rebalanceStrength`

Hidden in demo config: oracle, `ethToken`, `maxStaleness`, salt, deadline.

`maxTrade` is shown as a derived hint, never typed. No `targetWeight`.

Flow: connect account 0 → approve Aqua → `SisuStrategy.buildProgram` → ship.

## Swap

- Input / output, rate, fee, price impact
- Current risk, projected risk, risk limit
- If `canExecute === false`: warn with post vs max. **Swap stays clickable.**
- On revert, decode `SisuRiskLimitExceeded(post, max)` and show **Trade exceeds strategy risk limit** plus the three numbers
- Quote = `eth_call` of the same program. `canExecute` is “would Limit pass,” not a second model

## History

Local/session list of txs this app sent: hash, action (ship/swap/dock), success/revert, risk numbers when known. Persist in `localStorage`. No backend.

## Seed

`sisu/scripts/setup-ui.ts` leaves the local node UI-ready: deploy, fund accounts 0 and 1, ship one 50/50 strategy, write `sisu/web/lib/deployment.json`.

## Out

Indexer, AI, strategy studio, configurable target weights, multi-chain, WalletConnect/RainbowKit, published SDK, light mode, mobile, charting beyond the one allocation split.
