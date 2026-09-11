# DEPLOYMENT_INFO

Where Sisu is deployed, with what seed, and where to click.

## Networks

| Network   | RPC | Chain | Status |
|-----------|-----|-------|--------|
| Hardhat local | `http://127.0.0.1:8545` | 31337 | Live seed path (judge path) |
| BuildBear | `BUILDBEAR_RPC_URL` from `.env` | varies (recorded in `deployment.json`) | Ready to seed: `npx hardhat run scripts/setup-ui.ts --network buildbear`, then `npm run build` in `web/` so the UI bundles the new `deployment.json` + RPC. Paste explorer tx links below. |

## Local seed (`scripts/setup-ui.ts --network localhost`)

- Stack: Aqua, `SisuStrategy`, `SisuSwapVMRouter`, WETH mock, ETH/USDC
  `TokenMock` (18 decimals), `MockAggregatorV3` (8 decimals, $3000).
- Funds Hardhat accounts 0 (maker) and 1 (trader); approves Aqua + router.
- Ships one 50/50 book: 1 ETH + 3000 USDC, maxRisk 60% (`6e8`),
  baseFee 30 bps, maxFee 100 bps, strength `1e9`, salt 1, no deadline.
- Writes `web/lib/deployment.json` (gitignored; schema in
  `web/lib/deployment.example.json`).

## Reference transactions (local)

Seed output prints the strategy hash. `scripts/verify-trader.ts` reproduces
the Example Case from the README against the seeded node:

- safe 0.05 ETH → ~142.44 USDC, settles
- unsafe 5 ETH → `SisuRiskLimitExceeded(946525974, 600000000)`, no settlement

## Explorer links (BuildBear)

TBD after the public-network deploy: seed tx, ship tx, safe swap tx,
unsafe (reverted) tx.
