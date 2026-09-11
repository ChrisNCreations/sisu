# Sisu web

Product UI for the Sisu protocol: one risk-bounded ETH/USDC book.

Canonical product rules: `../docs/FRONTEND.md`. Build plan: `../../docs/specs/build.md`.
Language: `../../CONTEXT.md`.

## Stack

- Next.js App Router, TypeScript, Tailwind v4
- Design tokens from `../design`
- wagmi + viem, injected wallet only, Hardhat chain 31337
- Real onchain SDK (`lib/sdk/real.ts`: `eth_call` quote, router swap, revert
  decode) when `lib/deployment.json` exists (written by
  `../scripts/setup-ui.ts`); mock fallback otherwise so `npm run build`
  works without a node

## Develop

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # gate for UI changes
```

Needs a seeded node first: `npx hardhat node` + `npx hardhat run scripts/setup-ui.ts --network localhost` from `sisu/`.

## Screens

- `/` Dashboard — allocation, risk gauge, max-trade hint
- `/strategy` — maker deposits + policy, ship
- `/swap` — quote, projected risk, clickable unsafe swap
- `/history` — this browser's tx log (settled + reverted), no indexer

Keyboard: `⌘K` command palette, `G` then `D` / `S` / `W` / `H` to jump pages.
