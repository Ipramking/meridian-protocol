# Meridian Protocol

[![Contracts CI](https://github.com/Ipramking/meridian-protocol/actions/workflows/contracts.yml/badge.svg)](https://github.com/Ipramking/meridian-protocol/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Soroban](https://img.shields.io/badge/Soroban-v22-4c1d95.svg)](https://stellar.org/soroban)
[![Circle CCTP](https://img.shields.io/badge/Circle_CCTP-Domain_27-0f766e.svg)](https://developers.circle.com/cctp)

Cross-Chain Intent Router and Capital Settlement Engine for Stellar Soroban Real-World Assets (RWAs), Money Markets, and Fiat Anchors.

---

## Abstract

Meridian Protocol provides deterministic, single-signature liquidity routing between external EVM/SVM networks (Ethereum, Arbitrum, Base, Optimism, Solana) and the Stellar Soroban runtime. Built on Circle Cross-Chain Transfer Protocol (CCTP) and Soroswap Aggregator V3, Meridian eliminates destination account friction through native transaction envelope sponsorship and enables direct atomic settlement into permissioned institutional RWA vaults and SEP-24/SEP-6 fiat anchors.

---

## Core Primitives

### 1. Gasless Paymaster (`contracts/paymaster`)
EVM cross-chain transfers to fresh Stellar accounts suffer from a cold-start reserve requirement: destination wallets require native XLM for base reserves and transaction envelope fees before any Soroban contract invocation or swap can execute.

Meridian Paymaster resolves this by:
* Sponsoring base ledger envelope fees from an on-chain operational XLM reserve.
* Deducting an equivalent fractional fee directly from the bridged USDC principal.
* Maintaining automated rebalancing via Soroswap AMM pools to replenish XLM reserves upon reaching configurable volume thresholds.

### 2. Intent Routing Engine (`contracts/router`)
The `MeridianRouter` contract coordinates cross-chain message consumption, DEX routing, and downstream allocation:
* **Attestation Verification**: Ingests Circle Iris attestation signatures via the Stellar CCTP `MessageTransmitter` and `CctpForwarder` interfaces.
* **Atomic Route Execution**: Routes inbound USDC through Soroswap Aggregator V3 across Soroswap, Phoenix (CLMM), and Aquarius liquidity pools within a single host transaction.
* **Vault Dispatch**: Atomically deposits output tokens into downstream contracts implementing the standard Soroban Vault interface (`deposit(amount, recipient)`), including Spiko Treasury products and Blend isolated pools.
* **Replay Protection**: Enforces message hash uniqueness via temporary storage keys with automated ledger TTL bumping.

### 3. Institutional Compliance Gate (`contracts/compliance`)
Enforces identity verification rules for regulated assets on Soroban:
* Validates KYC credentials, country ISO codes, and accredited investor flags prior to routing capital into permissioned asset vaults.
* Integrates with Stellar SEP-8 regulated asset approval interfaces.

---

## Architecture Flow

```
[ EVM / SVM User ]
        │
        │ 1. Signs EIP-712 Intent & executes CCTP depositForBurn()
        ▼
[ Circle CCTP TokenMessenger ]
        │
        │ 2. Emits MessageSent; Circle Iris Attestation validated
        ▼
[ Meridian Relayer Daemon ]
        │
        │ 3. Fetches Iris attestation signature
        │ 4. Submits sponsored transaction envelope to Stellar
        ▼
[ MeridianRouter.rs (Soroban Host Runtime) ]
   ├── Calls CctpForwarder.mint_and_forward()
   ├── Settles Paymaster fee reimbursement (USDC)
   ├── Dispatches multi-hop swap via Soroswap Aggregator V3
   └── Allocates target assets to:
         ├── Recipient Stellar Account (G...)
         ├── Institutional RWA Vault (Blend / Spiko / Centrifuge)
         └── SEP-24 Anchor Escrow for Direct Bank Settlement
```

---

## Repository Structure

```
.
├── contracts/
│   ├── router/          # Core cross-chain intent settlement contract
│   ├── paymaster/       # Gas sponsorship and reserve rebalancer
│   └── compliance/      # Institutional KYC and SEP-8 access gate
├── packages/
│   └── sdk/             # @meridian-protocol/sdk TypeScript client library
├── services/
│   └── relayer/         # Circle Iris attestation listener and transaction relayer
├── apps/
│   └── web/             # Next.js 14 web client and dual-wallet interface
├── issues/
│   ├── ISSUES_CATALOG.md# Complete 160-issue Wave backlog specification
│   ├── issues.json      # Structured issue dataset with complexity tags
│   └── seed-issues.js   # Automated GitHub issue migration utility
└── .github/workflows/
    ├── contracts.yml    # Cargo test and WASM verification pipeline
    └── sdk-and-web.yml  # TypeScript typecheck and frontend build pipeline
```

---

## Development & Build Verification

### Prerequisites
* Rust `1.80+` with target `wasm32-unknown-unknown`
* Node.js `20.x` or higher
* Stellar CLI / Soroban CLI `v22+`

### Contracts
```bash
# Execute unit test suite
cargo test --workspace

# Build optimized WASM binaries
cargo build --target wasm32-unknown-unknown --release
```

### TypeScript SDK & Relayer
```bash
# Install workspace dependencies
npm install

# Build SDK package
npm run build --workspace=@meridian-protocol/sdk

# Build Relayer daemon
npm run build --workspace=@meridian-protocol/relayer
```

### Web Application
```bash
npm run dev --workspace=@meridian-protocol/web
```

---

## Security Invariants

1. **Conservation of Value**: The router contract never retains unallocated tokens. All inbound minted capital is either routed to the recipient, deposited into the target vault, or returned on failure.
2. **Strict Replay Prevention**: Every cross-chain intent message hash is recorded upon execution; subsequent invocations with identical hashes immediately revert.
3. **Bounded Slippage**: Swaps must satisfy `amount_out >= min_amount_out` enforced at both the router and DEX aggregator levels.
4. **Relayer Fee Caps**: Operational relayer fee deductions cannot exceed `max_relayer_fee_bps` configured by the contract administrator.

---

## License

Apache-2.0. Copyright (c) 2026 Ipramking.
