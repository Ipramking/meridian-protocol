# Meridian Protocol

[![Contracts CI](https://github.com/Ipramking/meridian-protocol/actions/workflows/contracts.yml/badge.svg)](https://github.com/Ipramking/meridian-protocol/actions)
[![SDK & Web CI](https://github.com/Ipramking/meridian-protocol/actions/workflows/sdk-and-web.yml/badge.svg)](https://github.com/Ipramking/meridian-protocol/actions)
[![Live Demo](https://img.shields.io/badge/Live_Demo-Online-10b981.svg)](https://ipramking.github.io/meridian-protocol/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Soroban](https://img.shields.io/badge/Soroban-v22-4c1d95.svg)](https://stellar.org/soroban)

Cross-Chain Intent Router and Capital Settlement Engine for Stellar Soroban Real-World Assets (RWAs), Money Markets, and Fiat Anchors.

* **Live Web Application Demo**: [https://ipramking.github.io/meridian-protocol/](https://ipramking.github.io/meridian-protocol/)
* **Architecture Specification**: [ARCHITECTURE.md](ARCHITECTURE.md)
* **On-Chain Deployment Manifest**: [deployments/testnet.json](deployments/testnet.json)

---

## Live On-Chain Deployments (Stellar Soroban Testnet)

All three core Soroban smart contracts are compiled to `wasm32v1-none`, deployed, and initialized on Stellar Soroban Testnet (`https://soroban-testnet.stellar.org`):

| Contract | Contract Address | Deploy Tx | Init Tx |
|---|---|---|---|
| **MeridianRouter** | [`CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED`](https://stellar.expert/explorer/testnet/contract/CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED) | [`97ed2a1d...`](https://stellar.expert/explorer/testnet/tx/97ed2a1d3945a1fc6c0ca33fbdd95c2b63a960b85bdc7b8c243804e106b1beb6) | [`ceff2fcb...`](https://stellar.expert/explorer/testnet/tx/ceff2fcbb1c61eac260f1bcf7883255d06fd658f7e7ef31d965b2700f2277b98) |
| **MeridianPaymaster** | [`CCZIOZNGCPEB5KQSQW4DECO3AFTNXLTAOECAR3ZBS3QVIG4KSMUS2S6I`](https://stellar.expert/explorer/testnet/contract/CCZIOZNGCPEB5KQSQW4DECO3AFTNXLTAOECAR3ZBS3QVIG4KSMUS2S6I) | [`dacc7fee...`](https://stellar.expert/explorer/testnet/tx/dacc7fee382ea17eb82552100ff06551b11e681cb3838068c4756a565f07fc05) | [`1b906928...`](https://stellar.expert/explorer/testnet/tx/1b906928f8423400fa6f954c5edafbe022f2530074bda462a1b3122a83ef5424) |
| **MeridianCompliance** | [`CB65GHAERYSDNPGZYMEPESEKGC3PKL6UNOPYAZV6QUFW37OL7J24YU2S`](https://stellar.expert/explorer/testnet/contract/CB65GHAERYSDNPGZYMEPESEKGC3PKL6UNOPYAZV6QUFW37OL7J24YU2S) | [`d84e11cb...`](https://stellar.expert/explorer/testnet/tx/d84e11cb4eb95354a1d37ffd18c3492ecd34120b22f17ae43408d94fd1c1710c) | [`9e0729de...`](https://stellar.expert/explorer/testnet/tx/9e0729de3da687076c282acbdb04fe762e2cbb81f6d8fef27fb7ea8acbfff031) |
| **MeridianRwaVault** | [`CC4IZUGVELOW5Z7OBUSZWQSPBPM64IQYFA52YQZ7WGFVDMWRVO4OYAGK`](https://stellar.expert/explorer/testnet/contract/CC4IZUGVELOW5Z7OBUSZWQSPBPM64IQYFA52YQZ7WGFVDMWRVO4OYAGK) | [`fe5172a0...`](https://stellar.expert/explorer/testnet/tx/fe5172a033ec825081ef13a3cc0688abcf80e58ed065c5de21c93bd888883e18) | [`65574d14...`](https://stellar.expert/explorer/testnet/tx/65574d14cca2f612cc8ae74f0bdf94e9de128be7e948c1c429da955e0ef409d5) |

---

## Abstract

Meridian Protocol provides deterministic, single-signature liquidity routing between external EVM/SVM networks (Ethereum, Arbitrum, Base, Optimism, Solana) and the Stellar Soroban runtime. Built on Circle Cross-Chain Transfer Protocol (CCTP) and Soroswap Aggregator V3, Meridian eliminates destination account friction through native transaction envelope sponsorship and enables direct atomic settlement into permissioned institutional RWA vaults and SEP-24/SEP-6 fiat anchors.

---

## Core Primitives

### 1. Gasless Paymaster (`contracts/paymaster`)
EVM cross-chain transfers to fresh Stellar accounts suffer from a cold-start reserve requirement: destination wallets require native XLM for base reserves and transaction envelope fees before any Soroban contract invocation or swap can execute.

Meridian Paymaster resolves this by:
* Sponsoring base ledger envelope fees from an on-chain operational XLM reserve.
* Deducting an equivalent fractional fee (with configurable basis-point markup) directly from the bridged USDC principal (`record_sponsorship`).
* Maintaining automated rebalancing (`rebalance_native`) via Soroswap AMM pools to replenish XLM reserves upon reaching configurable volume thresholds.

### 2. Intent Routing Engine (`contracts/router`)
The `MeridianRouter` contract coordinates cross-chain message consumption, DEX routing, and downstream allocation:
* **Attestation Verification**: Ingests Circle Iris attestation signatures via the Stellar CCTP interfaces.
* **Atomic Route Execution**: Routes inbound USDC through Soroswap Aggregator V3 across Soroswap, Phoenix (CLMM), and Aquarius liquidity pools within a single host transaction.
* **Vault Dispatch**: Atomically deposits output tokens into downstream contracts implementing the standard Soroban Vault interface (`deposit(amount, recipient)`), including Spiko Treasury products and Blend isolated pools.
* **Replay Protection**: Enforces message hash uniqueness via temporary storage keys with automated ledger TTL bumping.

### 3. Institutional Compliance Gate (`contracts/compliance`)
Enforces identity verification rules for regulated assets on Soroban:
* Validates KYC credentials, country ISO codes, and accredited investor flags prior to routing capital into permissioned asset vaults.
* Integrates with Stellar SEP-8 regulated asset approval interfaces.

### 4. Institutional RWA Yield Vault (`contracts/vault`)
The destination yield sink (`MeridianRwaVault` / `mTBILL`) completing the cross-chain pipeline:
* **Standard Soroban Vault Interface**: Exposes `deposit(amount, on_behalf_of)` called atomically by `MeridianRouter` upon CCTP minting.
* **Proportional Share Minting**: Calculates and issues tokenized yield shares based on current vault total assets and share supply.
* **Direct Access & Redemptions**: Accommodates direct user deposits (`deposit_direct`) and seamless share redemptions back into underlying USDC (`withdraw`).
* **Circuit Breaker Controls**: Admin toggle to pause and unpause vault activity in volatile market conditions.

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
│   ├── compliance/      # Institutional KYC and SEP-8 access gate
│   └── vault/           # Institutional RWA Yield Vault (mTBILL)
├── deployments/
│   └── testnet.json     # Live Stellar Soroban Testnet deployment manifest
├── packages/
│   └── sdk/             # @meridian-protocol/sdk TypeScript client library
├── services/
│   └── relayer/         # Circle Iris attestation listener and transaction relayer
├── apps/
│   └── web/             # Next.js 14 web client and dual-wallet interface
├── scripts/
│   └── deploy-testnet.mjs # Automated Soroban Testnet deployment & init script
└── .github/workflows/
    ├── contracts.yml    # Cargo test and WASM verification pipeline
    ├── sdk-and-web.yml  # TypeScript typecheck and frontend build pipeline
    └── deploy-pages.yml # Automated GitHub Pages deployment for Live Demo
```

---

## Development & Build Verification

### Prerequisites
* Rust `1.84+` with target `wasm32v1-none`
* Node.js `20.x` or higher

### Contracts
```bash
# Execute unit & integration test suite across all contracts
cargo test --workspace --lib

# Build optimized Soroban WASM binaries
cargo build --target wasm32v1-none --release
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
