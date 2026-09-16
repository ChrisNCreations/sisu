# DEPLOYMENT_INFO

Where Sisu is deployed, with what seed, and where to click.

## Networks

| Network   | RPC | Chain | Status |
|-----------|-----|-------|--------|
| Hardhat local | `http://127.0.0.1:8545` | 31337 | Live seed path (mocks) |
| Sepolia | `SEPOLIA_RPC_URL` from `.env` | 11155111 | Pair frozen. Featured book **shipped** (1 WETH + 3000 USDC). 2026-09-11 TokenMock seed is historical. |

## Public pair and featured book (Sepolia)

Pair verified read-only 2026-09-16. Sisu contracts and the featured book are live. Tokens stay in the maker wallet; Aqua virtual balances are 1 WETH + 3000 USDC. `npm run validate:deployment:sepolia` passed.

| Asset | Source | Address | On-chain |
|-------|--------|---------|----------|
| WETH | Uniswap Sepolia WETH9 | [`0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14`](https://sepolia.etherscan.io/address/0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14) | symbol `WETH`, name Wrapped Ether, 18 decimals |
| USDC | Circle official Sepolia USDC | [`0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`](https://sepolia.etherscan.io/address/0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238) | symbol `USDC`, 6 decimals. Faucet: https://faucet.circle.com |
| Mark | Chainlink ETH/USD | [`0x694AA1769357215DE4FAC081bf1f309aDC325306`](https://sepolia.etherscan.io/address/0x694AA1769357215DE4FAC081bf1f309aDC325306) | `description` = `ETH / USD`, 8 decimals, positive complete round, age ~43m |

Heartbeat 3600s, `SISU_ORACLE_MAX_STALENESS=7200`. Do not deploy `WETHMock`, `TokenMock`, or `MockAggregatorV3` on this network. Testnet USDC has no dollar backing.

### Featured book (live)

Maker `0x25D8bE971f8c5E7C6aFC8645a08D43B506A8e051` (distinct from deployer). Policy: maxRisk 60% (`6e8`), baseFee 30 bps, maxFee 100 bps, strength `1e9`, salt 1, maxStaleness 86400.

Strategy hash:

`0xdb8f8ff8a9e2d6452842502ce4a9b7118f4c9c25ca08bc816f472742f6173443`

| Contract | Address | Explorer |
|----------|---------|----------|
| Aqua | `0x386C5f161AA20Cc3bb8A91a2C99c26272D023A6E` | https://sepolia.etherscan.io/address/0x386C5f161AA20Cc3bb8A91a2C99c26272D023A6E |
| SisuStrategy | `0x013F9ef10921d9FDC8530b85681488303964CfF7` | https://sepolia.etherscan.io/address/0x013F9ef10921d9FDC8530b85681488303964CfF7 |
| SisuSwapVMRouter | `0x018F2e43dC538A1E76370fd8d6FDA7e6E554f471` | https://sepolia.etherscan.io/address/0x018F2e43dC538A1E76370fd8d6FDA7e6E554f471 |

Router constructor WETH is the Uniswap Sepolia WETH9 above. Testnet liquidity is experimental — do not deposit valuable assets.

A leftover `WETHMock` artifact exists under `deployments/sepolia/` and is **not** the product ETH leg.

## Local seed (`scripts/setup-ui.ts --network localhost`)

- Stack: Aqua, `SisuStrategy`, `SisuSwapVMRouter`, WETH mock, ETH/USDC
  `TokenMock` (18 decimals), `MockAggregatorV3` (8 decimals, $3000).
- Funds Hardhat accounts 0 (maker) and 1 (trader); approves Aqua + router.
- Ships one 50/50 book: 1 ETH + 3000 USDC, maxRisk 60% (`6e8`),
  baseFee 30 bps, maxFee 100 bps, strength `1e9`, salt 1, no deadline.
- Writes `web/lib/deployment.json` (gitignored; schema in
  `web/lib/deployment.example.json`).

## Historical: judged Sepolia seed (2026-09-11)

**Not the public product.** Mock ETH, mock USDC, mock mark. Maker = trader =
deployer `0x446F4fab225EEa73e53484D38D2D6089D82f00D2`. Strategy order hash:

`0x52c63c3e302c68bd1050795353a111c7b650800330aa56511aeae7eb41f8e12c`

| Contract | Address | Explorer |
|----------|---------|----------|
| Aqua | `0x3C79789Fc773962803d61115ee13DCa0b011D22f` | https://sepolia.etherscan.io/address/0x3C79789Fc773962803d61115ee13DCa0b011D22f |
| SisuStrategy | `0xCFDE9b3868A08eEAbBbC803a3f126BEa471E8bC9` | https://sepolia.etherscan.io/address/0xCFDE9b3868A08eEAbBbC803a3f126BEa471E8bC9 |
| SisuSwapVMRouter | `0xD2e8bA0284a1f19a33168e805F905084444c13d2` | https://sepolia.etherscan.io/address/0xD2e8bA0284a1f19a33168e805F905084444c13d2 |
| ETH (mock) | `0x830e9bccFd31cc2E19CA7ae5cfD061D268399f3c` | https://sepolia.etherscan.io/address/0x830e9bccFd31cc2E19CA7ae5cfD061D268399f3c |
| USDC (mock) | `0xBB161a52382494c4aF1C9b3b07d4Ff4Bfc0A3A5B` | https://sepolia.etherscan.io/address/0xBB161a52382494c4aF1C9b3b07d4Ff4Bfc0A3A5B |
| ETH/USD mark (mock) | `0x662CA6e79F4d0d95fFA1F42b4fc79a624AED8D27` | https://sepolia.etherscan.io/address/0x662CA6e79F4d0d95fFA1F42b4fc79a624AED8D27 |

All three product contracts show green source ticks on Sepolia Etherscan
(Aqua matched 1inch's own verified bytecode; Strategy + Router verified
2026-09-11 via `scripts/verify-etherscan.ts`, standard-json, solc 0.8.30,
optimizer runs 1, Cancun). Router creation tx:
https://sepolia.etherscan.io/tx/0x151d66e13e2df09c3bfbbdf319f2545aeab966312bd13be598f22fcbf04fa56f

`scripts/verify-trader.ts --network sepolia` against this deployment:

- safe quote 0.05 ETH → 142.448921274467781111 USDC, swap settles
  (single-key demo: maker and trader are the same EOA, so the net token
  delta is ~0; settlement is proven by the receipt + quote amounts)
- unsafe 5 ETH swap reverts, no settlement, maker balance unchanged

## Reference transactions (local)

Seed output prints the strategy hash. `scripts/verify-trader.ts` reproduces
the Example Case from the README against the seeded node:

- safe 0.05 ETH → ~142.44 USDC, settles
- unsafe 5 ETH → `SisuRiskLimitExceeded(946525974, 600000000)`, no settlement
