# Sisu — Architecture

> **Role:** origin design. Principles, risk math, trust boundaries, and invariants still hold. Instruction names, UI location, and SDK packaging do not — see workspace `docs/STATUS.md` and `docs/adr/`. Language: workspace `CONTEXT.md`.

## 1. Architecture Overview

Sisu is a four-layer system:

```text
┌─────────────────────────────────────────────┐
│                  FRONTEND                   │
│                                             │
│ Dashboard · Strategy · Swap · History       │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                    SDK                      │
│                                             │
│ Quotes · Simulation · Strategies · Tx       │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│              SISU PROTOCOL                  │
│                                             │
│ Strategy · Risk Math · Instructions         │
│ Opcodes · SwapVM Router                     │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│                    AQUA                     │
│                                             │
│ Virtual balances · Ship · Dock · Pull       │
│ Push · Atomic settlement                    │
└─────────────────────────────────────────────┘
```

---

# 2. Architectural Principle

The most important rule is:

> **Offchain components can calculate and display. Onchain components enforce.**

The frontend can estimate:

```text
Risk: 41% → 67%
```

The backend can index:

```text
Risk: 41%
```

But only the SwapVM strategy can decide:

```text
67% > 60%
→ REVERT
```

---

# 3. Layer 1 — Frontend

The frontend is a thin client over the protocol.

Recommended stack:

- React / Next.js
- TypeScript
- viem or ethers
- wagmi or equivalent wallet tooling
- lightweight charting library

The frontend should use established DeFi interaction patterns.

---

## 3.1 Dashboard

Displays:

```text
Strategy
ETH / USDC

Total value
$100,482

Allocation
ETH 62%
USDC 38%

Risk
42% / 60%

Fee
24.8 bps

Maximum trade
$18,420
```

---

## 3.2 Strategy Creation

The frontend collects:

```text
tokenA
tokenB
capital
targetWeight
maxRisk
baseFee
maxFee
rebalanceStrength
maxTrade
```

The SDK converts these values into the strategy/program format expected by the contracts.

The user signs the necessary approvals and strategy shipping transactions.

---

## 3.3 Swap Interface

The swap interface should feel familiar.

```text
Input
Output

Rate
Fee
Price impact

Current risk
Projected risk
Risk limit

[Swap]
```

The projected risk is informative.

The onchain instruction remains authoritative.

---

# 4. Layer 2 — Sisu SDK

The SDK isolates blockchain details from the UI.

Suggested API:

```typescript
interface SisuSDK {
    getStrategy(strategyHash: Hex): Promise<SisuStrategy>;

    getRisk(strategyHash: Hex): Promise<RiskState>;

    quoteSwap(params: QuoteParams): Promise<Quote>;

    simulateRisk(params: SimulationParams): Promise<RiskSimulation>;

    shipStrategy(params: ShipParams): Promise<TransactionRequest>;

    dockStrategy(params: DockParams): Promise<TransactionRequest>;

    swap(params: SwapParams): Promise<TransactionRequest>;
}
```

---

# 5. Quote Pipeline

A quote should follow:

```text
User enters amount
       ↓
SDK requests simulation
       ↓
SwapVM simulation
       ↓
XYC pricing
       ↓
Sisu risk calculation
       ↓
post-trade risk
       ↓
fee
       ↓
quote returned
```

Result:

```typescript
interface Quote {
    amountIn: bigint;
    amountOut: bigint;

    feeBps: bigint;

    currentRiskBps: bigint;
    postTradeRiskBps: bigint;
    maxRiskBps: bigint;

    canExecute: boolean;
}
```

---

# 6. Layer 3 — Sisu Protocol

The protocol is divided into five components.

```text
SisuRiskMath
      ↓
Sisu Instructions
      ↓
Sisu Opcodes
      ↓
Sisu SwapVM Router
      ↓
Aqua
```

---

# 7. SisuRiskMath

This library contains pure mathematical functions.

File:

```text
contracts/libraries/SisuRiskMath.sol
```

Responsibilities:

```solidity
risk()
postTradeRisk()
riskFee()
maxTrade()
rebalancePressure()
finalFee()
```

The library must contain no external calls.

This makes it:

- deterministic,
- easy to unit test,
- easy to fuzz,
- easy to audit.

---

# 8. Risk Function

For values \(A\) and \(B\):

\[
V=A+B
\]

\[
D=|A-B|
\]

\[
\boxed{
Risk=\frac{D}{V}
}
\]

Solidity:

```solidity
function riskBps(
    uint256 valueA,
    uint256 valueB
) internal pure returns (uint256) {
    uint256 total = valueA + valueB;

    if (total == 0) {
        return 0;
    }

    uint256 diff = valueA > valueB
        ? valueA - valueB
        : valueB - valueA;

    return diff * BPS / total;
}
```

Production implementation should use overflow-safe multiplication/division.

---

# 9. Post-Trade Risk

For A input:

```text
newA = valueA + valueIn
newB = valueB - valueOut
```

For B input:

```text
newA = valueA - valueOut
newB = valueB + valueIn
```

Then:

\[
RiskPost=
\frac{|newA-newB|}
{newA+newB}
\]

This function is the foundation of `SisuLimit`.

---

# 10. SisuRisk Instruction

Responsibilities:

1. Read current SwapVM state.
2. Determine strategy parameters.
3. Calculate current risk.
4. Calculate normalized risk.
5. Calculate risk-dependent fee.
6. Pass execution to the next instruction.

Conceptually:

```text
SwapVM Context
      ↓
balanceIn / balanceOut
      ↓
SisuRisk
      ↓
current risk
      ↓
fee adjustment
```

---

# 11. SisuRebalance Instruction

This instruction determines whether the current trade direction improves or worsens the inventory state.

Inputs:

```text
current inventory
tokenIn
tokenOut
rebalanceStrength
current risk
```

Output:

```text
rebalance multiplier
```

Formula:

\[
M=1+PSr
\]

where:

- \(P\) = directional inventory pressure,
- \(S\) = configured strength,
- \(r\) = normalized risk.

---

# 12. SisuLimit Instruction

This is the security-critical instruction.

Execution:

```text
XYC_SWAP
    ↓
amountIn
amountOut
    ↓
SisuLimit
    ↓
simulate final balances
    ↓
calculate RiskPost
    ↓
RiskPost <= MaxRisk?
```

If false:

```solidity
revert SisuRiskLimitExceeded(
    postRiskBps,
    maxRiskBps
);
```

If true:

```text
continue execution
```

---

# 13. Why SisuLimit Comes After Pricing

Before the AMM pricing instruction, the final `amountOut` may not yet be known.

Therefore:

```text
SISU_RISK
       ↓
XYC_SWAP
       ↓
SISU_LIMIT
```

allows `SisuLimit` to calculate the risk using the actual final trade amounts.

This is particularly important for:

- exact input,
- exact output.

Both must eventually pass through the same post-trade invariant.

---

# 14. Opcode Layer

File:

```text
contracts/opcodes/SisuOpcodes.sol
```

Responsibilities:

- define Sisu opcode identifiers,
- extend the relevant base opcode table,
- map opcode IDs to instruction implementations.

Conceptually:

```solidity
enum SisuOpcode {
    SISU_RISK,
    SISU_REBALANCE,
    SISU_LIMIT
}
```

The actual representation must follow the pinned SwapVM architecture in the repository.

---

# 15. SwapVM Router

File:

```text
contracts/routers/SisuSwapVMRouter.sol
```

Responsibilities:

- inherit the required SwapVM components,
- expose the Sisu opcode table,
- dispatch Sisu instructions,
- preserve standard SwapVM execution semantics.

Conceptually:

```text
AquaSwapVMRouter
       ↓
SisuSwapVMRouter
       ↓
Base opcodes
+
Sisu opcodes
```

Sisu should extend the existing infrastructure rather than fork unrelated SwapVM logic.

---

# 16. Strategy Layer

File:

```text
contracts/strategy/SisuStrategy.sol
```

Responsibilities:

- construct Sisu strategy programs,
- encode policy parameters,
- build strategy metadata,
- generate strategy hashes,
- configure deadline/salt.

Example policy:

```text
maker
tokenA
tokenB
targetWeight
maxRisk
baseFee
maxFee
rebalanceStrength
maxTrade
deadline
salt
```

The policy becomes part of the immutable strategy representation.

---

# 17. Aqua Layer

Aqua is the shared liquidity and settlement layer.

Aqua provides:

```text
ship()
dock()
pull()
push()
safeBalances()
```

The current Aqua documentation describes it as self-custodial: the protocol tracks virtual balances while actual tokens remain in the maker's wallet.

---

# 18. Strategy Lifecycle

```text
CREATE
  ↓
APPROVE
  ↓
SHIP
  ↓
ACTIVE
  ↓
SWAP
  ↓
UPDATED BALANCES
  ↓
DOCK
  ↓
CLOSED
```

---

# 19. Shipping

The LP:

1. approves Aqua,
2. builds Sisu program,
3. calculates strategy hash,
4. calls `ship()`.

The strategy becomes available for execution.

---

# 20. Swap Execution

The complete execution path:

```text
Trader
  │
  ▼
Sisu SDK
  │
  ▼
Sisu SwapVM Router
  │
  ├── Controls
  │
  ├── SisuRisk
  │
  ├── XYC Swap
  │
  ├── SisuRebalance
  │
  └── SisuLimit
  │
  ▼
Aqua
  │
  ├── pull output token
  │
  └── push input token
  │
  ▼
Maker / Trader balances
```

The exact instruction sequence will be finalized after validating the pinned SwapVM version in the existing repository.

---

# 21. Aqua Virtual Balance vs Wallet Balance

This distinction must be represented clearly in the application.

### Virtual liquidity

What the strategy has allocated inside Aqua.

### Executable liquidity

What the maker's wallet can actually fulfill.

They are not necessarily identical.

Aqua's current documentation explicitly states that `pull()` checks actual maker wallet balance and that an underfunded strategy simply stops filling until funded or docked.

Therefore the Sisu dashboard should eventually display both.

---

# 22. Backend / Indexer

The backend is optional for MVP execution.

If implemented:

```text
Blockchain
    ↓
Event Listener
    ↓
Indexer
    ↓
Database
    ↓
API
    ↓
Frontend
```

Events to index:

```text
Shipped
Docked
Pulled
Pushed
Swapped
```

Useful derived data:

```text
strategy history
swap history
risk history
volume
fees
blocked trade attempts
```

The backend cannot override protocol state.

---

# 23. Data Flow

## Strategy creation

```text
Frontend
  ↓
Sisu SDK
  ↓
Build policy
  ↓
Encode SwapVM program
  ↓
Wallet signature
  ↓
Aqua.ship()
  ↓
Strategy active
```

---

## Quote

```text
Frontend
  ↓
Sisu SDK
  ↓
Simulation
  ↓
SwapVM
  ↓
SisuRisk
  ↓
XYC
  ↓
SisuLimit
  ↓
Quote
```

---

## Swap

```text
Frontend
  ↓
Wallet
  ↓
SwapVM
  ↓
SisuRisk
  ↓
XYC
  ↓
SisuLimit
  ↓
Aqua.pull()
  ↓
Aqua.push()
  ↓
Atomic settlement
```

---

# 24. Failure Flow

Unsafe trade:

```text
Trader
  ↓
SwapVM
  ↓
XYC computes trade
  ↓
SisuLimit
  ↓
RiskPost > MaxRisk
  ↓
REVERT
  ↓
No token settlement
```

The frontend should interpret the revert and show:

```text
Trade exceeds strategy risk limit.

Current risk: 57%
Projected risk: 71%
Maximum: 60%
```

---

# 25. Security Boundaries

## Frontend

Untrusted.

Can be modified.

Can only display/submit transactions.

## Backend

Untrusted.

Provides indexing and analytics.

Cannot authorize trades.

## SDK

Untrusted.

Provides transaction construction and simulation.

Cannot bypass protocol rules.

## SwapVM

Trusted execution layer.

Enforces Sisu instructions.

## Aqua

Settlement and accounting layer.

## Maker wallet

Actual asset custody remains with maker.

---

# 26. Testing Architecture

```text
              Unit Tests
                  │
        ┌─────────┴─────────┐
        │                   │
   Risk Math           Fee Math
        │                   │
        └─────────┬─────────┘
                  │
            Instruction Tests
                  │
                  ▼
            Opcode Tests
                  │
                  ▼
          SwapVM Integration
                  │
                  ▼
          Aqua Integration
                  │
                  ▼
          End-to-End Tests
```

---

# 27. Core Invariants

### Invariant 1

Risk is bounded:

\[
0\le Risk\le1
\]

### Invariant 2

Unsafe trade cannot settle:

\[
RiskPost>MaxRisk
\Rightarrow REVERT
\]

### Invariant 3

Boundary trade is valid:

\[
RiskPost=MaxRisk
\Rightarrow ALLOW
\]

### Invariant 4

Risk is symmetric:

\[
Risk(A,B)=Risk(B,A)
\]

### Invariant 5

Risk calculation is deterministic.

### Invariant 6

Frontend calculations must not affect security.

### Invariant 7

Actual Aqua settlement remains atomic.

---

# 28. Repository Mapping

```text
contracts/
│
├── libraries/
│   └── SisuRiskMath.sol
│       Pure mathematical model
│
├── instructions/
│   ├── SisuRisk.sol
│   ├── SisuLimit.sol
│   └── SisuRebalance.sol
│
├── opcodes/
│   └── SisuOpcodes.sol
│
├── routers/
│   └── SisuSwapVMRouter.sol
│
├── strategy/
│   └── SisuStrategy.sol
│
└── callbacks/
    └── SisuTaker.sol
```

---

# 29. Frontend Mapping

```text
app/web/

app/
├── dashboard/
├── strategy/
│   ├── create/
│   └── [strategyHash]/
├── swap/
├── history/
└── components/
    ├── RiskGauge
    ├── StrategyCard
    ├── SwapPanel
    ├── RiskPreview
    └── TransactionStatus
```

---

# 30. SDK Mapping

```text
packages/sisu-sdk/

src/
├── client.ts
├── strategy.ts
├── quote.ts
├── risk.ts
├── swap.ts
├── aqua.ts
└── types.ts
```

---

# 31. Development Sequence

## Phase 0 — Baseline

Confirm:

```text
build
test
deploy
```

Commit:

```text
chore: establish Sisu baseline
```

---

## Phase 1 — Risk Math

Implement:

```text
SisuRiskMath.sol
```

Tests:

```text
SisuRiskMath.test.ts
```

Commit:

```text
feat: implement Sisu inventory risk model
```

---

## Phase 2 — Strategy

Implement:

```text
SisuStrategy.sol
```

Commit:

```text
feat: encode Sisu risk policy
```

---

## Phase 3 — Instructions

Implement:

```text
SisuRisk
SisuRebalance
SisuLimit
```

Commit:

```text
feat: add Sisu SwapVM instructions
```

---

## Phase 4 — Router

Implement:

```text
SisuOpcodes
SisuSwapVMRouter
```

Commit:

```text
feat: add Sisu SwapVM router
```

---

## Phase 5 — Aqua Integration

Prove:

```text
ship
swap
pull
push
dock
```

Commit:

```text
test: prove Sisu Aqua settlement
```

---

## Phase 6 — Risk Enforcement

Prove:

```text
safe trade → success
unsafe trade → revert
rebalance trade → success
```

Commit:

```text
test: enforce Sisu post-trade risk limit
```

---

## Phase 7 — SDK

Build:

```text
quote
simulate
ship
swap
dock
```

---

## Phase 8 — Frontend

Build only:

```text
Dashboard
Create Strategy
Strategy Detail
Swap
Transaction
```

---

## Phase 9 — Demo

Create:

```text
scripts/demo.ts
```

which reproduces the complete judging scenario.

---

# 32. Demo Architecture

The demo should be deterministic.

```text
Seed maker
     ↓
Create 50/50 strategy
     ↓
Ship to Aqua
     ↓
Show dashboard
     ↓
Execute safe trade
     ↓
Show risk increase
     ↓
Execute dangerous trade
     ↓
Show revert
     ↓
Execute rebalancing trade
     ↓
Show risk reduction
     ↓
Show onchain transactions
```

---

# 33. Optional AI

AI is a separate layer:

```text
                    AI
                     │
             policy recommendation
                     │
                     ▼
                 LP approval
                     │
                     ▼
              Sisu Strategy
                     │
                     ▼
                  SwapVM
                     │
                     ▼
                   Aqua
```

AI never bypasses:

```text
RiskPost <= MaxRisk
```

---

# 34. Architectural Non-Goals

Sisu will not become:

- a generalized DEX,
- a liquidity aggregator,
- a lending protocol,
- a perpetuals protocol,
- a prediction market,
- an AI autonomous trader,
- a portfolio-management suite,
- a multi-chain protocol during the hackathon.

The architecture is intentionally optimized for one strong primitive.

---

# 35. Final Architecture

```text
                         SISU
                          │
              ┌───────────┴───────────┐
              │                       │
           LP USER                 TRADER
              │                       │
              ▼                       ▼
      ┌───────────────┐       ┌───────────────┐
      │   Dashboard   │       │   Swap UI     │
      └───────┬───────┘       └───────┬───────┘
              │                       │
              └──────────┬────────────┘
                         ▼
                   ┌───────────┐
                   │ Sisu SDK  │
                   └─────┬─────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Sisu Strategy     │
              │                     │
              │ Risk Policy         │
              │ Fee Policy          │
              │ Rebalance Policy    │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │       SwapVM        │
              │                     │
              │ SisuRisk            │
              │ XYC                 │
              │ SisuRebalance       │
              │ SisuLimit           │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │        Aqua         │
              │                     │
              │ Virtual Liquidity   │
              │ Pull / Push         │
              │ Ship / Dock         │
              └──────────┬──────────┘
                         │
                         ▼
                   Maker Wallet

               THE CORE INVARIANT

              RiskPost <= MaxRisk
                       │
                 ┌─────┴─────┐
                 │           │
                YES          NO
                 │           │
              SETTLE        REVERT
```

---

# 36. Architecture Principle

The entire Sisu system can ultimately be described in one sentence:

> **The frontend makes Sisu understandable, the SDK makes it usable, SwapVM makes the risk policy executable, and Aqua makes the liquidity self-custodial and shareable.**