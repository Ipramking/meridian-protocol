# Meridian Protocol â€” Security Self-Assessment & Audit Readiness Report

## 1. Executive Summary & Audit Scope

This document provides the pre-audit security self-assessment, threat model, trust boundary analysis, and formal invariant-to-test matrix for the **Meridian Protocol** smart contract suite on Stellar Soroban (`soroban-sdk = 22.0.8`, target `wasm32v1-none`).

### 1.1 In-Scope Soroban Contracts

| Contract | Source Path | Deployed Testnet Contract ID | WASM SHA-256 |
| :--- | :--- | :--- | :--- |
| **`MeridianRouter`** | `contracts/router/src/{lib,types,errors}.rs` | `CD6BDASBGQNDY6K66ZWG5IVOZXAAJ3IWD2WWEA25KF6R6UTU6ZUWBOCR` | `3865b1326f3fa1a37604fc1b2ac970e0b3d8f2c21cead6e1d8d0132d91ecc42d` |
| **`MeridianRwaVault` (Open `mvUSDC`)** | `contracts/vault/src/lib.rs` | `CAYGFI63GSSZL2PRN4QZ37UAQ6ITAPARJ4WDAO27765GWP2QNDW3LF6L` | `92cfcd409b1653a37e9e9eb9a74a8a0e52b978c2c887691d083bf7a8263b455f` |
| **`MeridianRwaVault` (Accredited `maUSDC`)** | `contracts/vault/src/lib.rs` | `CCTCBCSN2YT4UWGFI6XEL3P3TPZOKCXEWQAP4NCA4Q5B46ODE77DPPQH` | `92cfcd409b1653a37e9e9eb9a74a8a0e52b978c2c887691d083bf7a8263b455f` |
| **`MeridianCompliance`** | `contracts/compliance/src/lib.rs` | `CAHUSTNCX7KAQSB5P4AAFUTWCPJ5H2FEUAOX5RPGCVZO4E24TO5BQZFC` | `9cf80c10d62f0d194e0ab3c0ab0081cf95d7442edfe6535b7910533484cca9d3` |
| **`MeridianPaymaster`** | `contracts/paymaster/src/{lib,storage}.rs` | `CDIK7H27J4BCVQWSPMALTPXNVBRUZSCLR3PGCFCOVG2AJMY2RLN3C2AK` | `6fd906b1ea9242faa2c8fde94aa67fc2fc4d31c3da1b50a719d67791fb02b761` |

### 1.2 In-Scope Off-Chain & SDK Components

| Component | Source Path | Security Role |
| :--- | :--- | :--- |
| **`@meridian-protocol/sdk`** | `packages/sdk/src/{intent,cctp,router,client,paymaster,dex,anchor}.ts` | Deterministic XDR encoding (`encodeIntent`), order ID derivation (`computeOrderId`), Circle Iris V2 message parsing, and Soroban transaction simulation |
| **`@meridian-protocol/relayer`** | `services/relayer/src/{attestation-watcher,soroban-executor,index}.ts` | Verifies Circle CCTP V2 attestations before fronting relayer liquidity via `MeridianRouter::execute_intent` |

---

## 2. System Architecture & Trust Boundaries

```
+-------------------------------------------------------------------------+
| Origin EVM / Solana Chain (CCTP Domains: 0, 1, 2, 3, 5, 6, 7)           |
|   User burns USDC via Circle TokenMessengerV2 (destinationDomain = 27)  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Circle Iris Attestation Service (Off-Chain Boundary)                    |
|   Produces signed attestation over CCTP V2 burn message                 |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Meridian Relayer (`services/relayer`)                                   |
|   1. Polls Circle Iris until status == "complete"                       |
|   2. Verifies sourceDomain, destinationDomain == 27, mintRecipient      |
|   3. Signs & submits `MeridianRouter::execute_intent` using own USDC    |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
| Stellar Soroban On-Chain Trust Boundary                                 |
|                                                                         |
|   +--------------------+       is_eligible()     +--------------------+ |
|   |   MeridianRouter   | ----------------------> | MeridianCompliance | |
|   +---------+----------+                         +--------------------+ |
|             |                                                           |
|             +---> Soroswap Router (`swap_exact_tokens_for_tokens`)      |
|             |                                                           |
|             +---> MeridianRwaVault (`deposit` / `withdraw`)             |
+-------------------------------------------------------------------------+
```

### 2.1 Actor & Privilege Model

1. **Protocol Admin (`GDLTNOEQAQ6C5YRXMCA4VGSFPH55ZBBPUNYTX7OPUYQGWAGTHD4N57LC` on Testnet)**:
   - Can allowlist or disable vaults and toggle KYC requirement via `MeridianRouter::set_vault`.
   - Can pause/unpause `MeridianRouter::set_paused` and `MeridianRwaVault::set_paused`.
   - Can distribute realized yield into vaults via `MeridianRwaVault::distribute_yield` (requires transferring real USDC from admin balance).
   - Can record/revoke KYC verification via `MeridianCompliance::set_verification` and `MeridianCompliance::revoke`.
   - Can toggle `MeridianPaymaster::set_active` and trigger `MeridianPaymaster::rebalance_native`.
   - **Cannot** confiscate vault depositor shares, block `MeridianRwaVault::withdraw` (withdrawals remain open even when paused), or set `max_relayer_fee_bps > 1_000` (10% hard ceiling).
2. **Relayer**:
   - Unprivileged on-chain caller in `MeridianRouter::execute_intent`.
   - Must authorize transferring `net_amount = intent.amount_in - intent.relayer_fee` from **its own USDC balance** (`relayer.require_auth()`).
   - Cannot drain stray tokens held by `MeridianRouter`.
3. **Vault Depositor / End User**:
   - Authorizes `MeridianRouter::deposit`, `MeridianRwaVault::deposit_direct`, or `MeridianRwaVault::withdraw` (`from.require_auth()` / `owner.require_auth()`).
   - Retains unconditional withdrawal rights in `MeridianRwaVault::withdraw` regardless of pause state.

---

## 3. Protocol Invariants & Test Coverage Matrix

Every security invariant is enforced in Rust contract code and verified by automated unit/integration tests in `contracts/*/src/test.rs`.

### 3.1 `MeridianRouter` Invariants

| ID | Invariant Description | Enforcement Location | Error Code | Verifying Test |
| :--- | :--- | :--- | :--- | :--- |
| **R-01** | Single initialization only; `max_relayer_fee_bps` cannot exceed `MAX_FEE_BPS_CEILING` (`1_000` bps = 10%). | `contracts/router/src/lib.rs:43-48` | `AlreadyInitialized (1)`, `InvalidFeeConfig (16)` | `router::test::test_router_initialization` |
| **R-02** | `execute_intent` pulls `net_amount` strictly from `relayer` (`relayer.require_auth()`), never from router balances. | `contracts/router/src/lib.rs:135,157-162` | Host auth / token balance error | `router::test::test_router_balance_cannot_be_drained` |
| **R-03** | Deterministic `order_id = sha256(message_hash \|\| xdr(intent))` prevents intent replay and cross-intent griefing. | `contracts/router/src/lib.rs:109-114,151-155` | `AlreadyFilled (12)` | `router::test::test_fill_uses_relayer_liquidity_and_blocks_replay` |
| **R-04** | Intents must satisfy `now <= deadline <= now + 7 days` (`MAX_DEADLINE_WINDOW_SECS = 604_800`) so `Fill` TTL (`90 days`) always outlives replay windows. | `contracts/router/src/lib.rs:25,252-261` | `ExpiredDeadline (4)`, `DeadlineTooFar (17)` | `router::test::test_deadline_fee_and_amount_bounds` |
| **R-05** | `intent.amount_in > 0` and `0 <= intent.relayer_fee <= (amount_in * max_relayer_fee_bps) / 10_000`. | `contracts/router/src/lib.rs:143-149` | `ZeroAmount (7)`, `RelayerFeeExceeded (10)` | `router::test::test_deadline_fee_and_amount_bounds` |
| **R-06** | Multi-hop swap paths must start with `config.usdc_token` and deliver `amount_out >= intent.min_amount_out`. | `contracts/router/src/lib.rs:276-289` | `InvalidPath (6)`, `SlippageExceeded (5)` | `router::test::test_deadline_fee_and_amount_bounds` |
| **R-07** | Destination vaults must be explicitly allowlisted (`VaultPolicy { enabled: true }`) before receiving funds via `execute_intent` or `deposit`. | `contracts/router/src/lib.rs:363-370` | `VaultNotAllowed (14)` | `router::test::test_vault_must_be_allowlisted` |
| **R-08** | Vaults with `requires_kyc == true` require `MeridianCompliance::is_eligible(on_behalf_of) == true`. | `contracts/router/src/lib.rs:372-381` | `NotEligible (15)` | `router::test::test_kyc_vault_requires_eligibility` |
| **R-09** | Scoped sub-contract pre-authorization (`authorize_as_current_contract`) authorizes only the exact `token_in.transfer(router, first_pair, amount)` leg during Soroswap swaps. | `contracts/router/src/lib.rs:325-335` | Host auth error | `router::test::test_swap_leg_with_strict_auth` |
| **R-10** | Pausing the router blocks `execute_intent` and `deposit` until unpaused by `admin`. | `contracts/router/src/lib.rs:138-140,207-209` | `Paused (13)` | `router::test::test_pause_blocks_execution` |

### 3.2 `MeridianRwaVault` Invariants

| ID | Invariant Description | Enforcement Location | Error Code | Verifying Test |
| :--- | :--- | :--- | :--- | :--- |
| **V-01** | `deposit` can only be invoked with `meta.router.require_auth()`, preventing unauthorized allowance pulls. | `contracts/vault/src/lib.rs:108-116` | Host auth error | `vault::test::test_deposit_requires_router_auth` |
| **V-02** | Share accounting obeys `shares_to_mint = (amount * total_shares) / total_assets` (1:1 when empty) and rejects zero-share rounding dust (`shares_to_mint == 0`). | `contracts/vault/src/lib.rs:251-258` | `ZeroAmount (4)` | `vault::test::test_distributed_yield_raises_share_price`, `vault::test::test_zero_amount_rejected` |
| **V-03** | `distribute_yield` requires `total_shares > 0` and pulls real underlying USDC from `admin` (`meta.admin.require_auth()`). | `contracts/vault/src/lib.rs:184-205` | `NoShares (7)` | `vault::test::test_distributed_yield_raises_share_price` |
| **V-04** | `withdraw` remains operational even when `meta.paused == true`, ensuring non-custodial exit at all times. | `contracts/vault/src/lib.rs:151-179` | `InsufficientShares (5)` | `vault::test::test_vault_direct_deposit_and_pause` |

### 3.3 `MeridianCompliance` & `MeridianPaymaster` Invariants

| ID | Invariant Description | Enforcement Location | Error Code | Verifying Test |
| :--- | :--- | :--- | :--- | :--- |
| **C-01** | `is_eligible(account)` returns `true` iff `status.is_verified && env.ledger().timestamp() <= status.expires_at`. | `contracts/compliance/src/lib.rs:95-100` | `NotVerified (3)` | `compliance::test::test_compliance_flow`, `compliance::test::test_verification_expires` |
| **P-01** | `record_sponsorship` requires both `caller.require_auth()` and `user.require_auth()` and charges `usdc_fee_amount + (usdc_fee_amount * fee_markup_bps) / 10_000`. | `contracts/paymaster/src/lib.rs:106-164` | `InvalidAmount (6)`, `Inactive (4)` | `paymaster::test::test_record_sponsorship_deducts_usdc_with_markup_and_accumulates` |
| **P-02** | `rebalance_native` requires `config.admin.require_auth()` and `accumulated >= amount_to_swap`. | `contracts/paymaster/src/lib.rs:167-244` | `InsufficientBalance (5)` | `paymaster::test::test_rebalance_native_swaps_accumulated_usdc_for_xlm`, `paymaster::test::test_paymaster_pause_and_error_guards` |

---

## 4. Threat Analysis (STRIDE) & Mitigations

| Threat Category | Attack Scenario | Mitigation in Meridian Protocol | Residual Risk |
| :--- | :--- | :--- | :--- |
| **Spoofing / Auth Bypass** | Attacker calls `MeridianRwaVault::deposit` directly to spend router allowance for their own address. | `MeridianRwaVault::deposit` calls `meta.router.require_auth()`, which only succeeds when invoked inside `MeridianRouter::route_to_vault`. | **None** (verified by `test_deposit_requires_router_auth`). |
| **Tampering / Intent Mutation** | Relayer alters `recipient`, `min_amount_out`, or `relayer_fee` on an attested CCTP burn. | `order_id` hashes `message_hash \|\| xdr(intent)`. Any modification changes `order_id`, and off-chain settlement audits compare the filled `CrossChainIntent` against the user's signed quote/burn parameters. | **Low**: On-chain CCTP V2 verifier integration is tracked for mainnet launch. |
| **Replay / Double Fill** | Relayer or third party replays a previously executed `(intent, message_hash)` pair. | `DataKey::Fill(order_id)` is stored in persistent storage with a 90-day TTL (`RECORD_BUMP`), while `check_deadline` rejects intents with deadlines > 7 days in the future (`MAX_DEADLINE_WINDOW_SECS`). | **None** (verified by `test_fill_uses_relayer_liquidity_and_blocks_replay`). |
| **First-Depositor / Share Inflation** | Attacker donates assets before first deposit or calls `distribute_yield` with 0 shares to skew share price. | `total_assets` is tracked internally in `VaultMetadata` (immune to direct ERC-20/SAC transfers outside `deposit`/`distribute_yield`), and `distribute_yield` rejects when `total_shares == 0` (`VaultError::NoShares`). | **None** (verified by `test_distributed_yield_raises_share_price`). |
| **Denial of Service (Admin Pause)** | Compromised or unresponsive admin pauses the vault, trapping user funds. | `MeridianRwaVault::withdraw` deliberately omits the `!meta.paused` guard so users can always redeem their shares for underlying USDC. | **None** (verified by `test_vault_direct_deposit_and_pause`). |

---

## 5. Known Limitations & Pre-Mainnet Audit Checklist

1. **Multi-Sig Admin Governance**: On testnet, `admin` is a single Ed25519 account (`GDLTNOEQAQ6C5YRXMCA4VGSFPH55ZBBPUNYTX7OPUYQGWAGTHD4N57LC`). Prior to mainnet deployment, `admin` across all four contracts must be a Stellar multi-signature account or timelock governance contract.
2. **Paymaster Storage TTL**: `MeridianPaymaster` stores `Config` and `AccumulatedFees` in instance storage and `SponsoredVolume` in persistent storage; adding explicit TTL extension helpers matching `MeridianRouter` (`extend_ttl`) is recommended for long-lived mainnet deployments.
3. **Reproducible Builds & Verification**:
   - Build all contracts: `cargo build --workspace --target wasm32v1-none --release`
   - Run full Rust test suite: `npm run contracts:test`
   - Run SDK & invariant verification tests: `npm run test --workspace=@meridian-protocol/sdk`
