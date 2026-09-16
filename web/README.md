# Sisu web

Product UI for the Sisu protocol: one risk-bounded ETH/USDC book.

Canonical product rules: `../docs/FRONTEND.md`. Remaining UI work: `../../docs/specs/frontend.md`.
Build plan: `../../docs/specs/build.md`. Language: `../../CONTEXT.md`.

## Stack

- Next.js App Router, TypeScript, Tailwind v4
- Design tokens from `../design`
- wagmi + viem, injected wallet only. Chain id and RPC come from the seed
  manifest (Hardhat `31337` or Sepolia `11155111`). Named Connect CTA via
  EIP-6963; connected pill copies, links the explorer, and disconnects.
- Compact top bar. No command palette, sidebar, or `G` jumps.
- Real onchain SDK (`lib/sdk/real.ts`: `eth_call` quote, router swap, ship,
  dock, revert decode, manifest token/oracle decimals) when
  `lib/deployment.json` exists (written by `../scripts/setup-ui.ts`); mock
  fallback otherwise so `npm run build` works without a node

## Develop

From `sisu/`:

```bash
npx hardhat node
npm run seed:local
```

From `sisu/web/`:

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # gate for UI changes
```

Open `/` (static landing), then **Launch App** to `/dashboard`. Connect
Hardhat account 1 on `http://127.0.0.1:8545` (chain 31337).

## Screens

- `/` — static landing. No wallet, no SDK, no seed needed.
- `/dashboard` — allocation, risk gauge, max-trade hint, virtual vs wallet, dock
- `/strategy` — maker deposits + policy, ship
- `/swap` — quote, RiskPost, clickable unsafe swap ("Swap anyway")
- `/history` — this browser's tx log (settled + reverted), no indexer

Public Sepolia still lacks a WETH wrap step, wallet chain-mismatch copy, and
connected-wallet faucet-balance gates. Do not treat an unseeded build as a
live book — it falls back to the mock SDK.
