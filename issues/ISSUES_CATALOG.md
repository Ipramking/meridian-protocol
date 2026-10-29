# Meridian Protocol — Complete Issue Catalog (Drips Wave Backlog)

Total Curated Issues: **160**  
Total Potential Points: **22,050 Points**

---

## Breakdown by Track & Complexity

| Category | Total Issues | Trivial (100 Pts) | Medium (150 Pts) | High (200 Pts) | Category Points |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Smart Contracts (Soroban & Rust)** | 25 | 8 | 10 | 7 | 3,700 |
| **Paymaster & Zero-XLM Gasless Infrastructure** | 23 | 9 | 11 | 3 | 3,150 |
| **Institutional Compliance & SEP-8 Gate** | 20 | 10 | 6 | 4 | 2,700 |
| **Bridges & Cross-Chain Oracles** | 22 | 8 | 10 | 4 | 3,100 |
| **TypeScript SDK (@meridian-protocol/sdk)** | 25 | 14 | 7 | 4 | 3,250 |
| **Frontend UI/UX & Web3 Integrations** | 23 | 14 | 7 | 2 | 2,850 |
| **Fiat Off-Ramps & Stellar SEP Standards** | 10 | 1 | 4 | 5 | 1,700 |
| **DevOps, Security, Testing & Documentation** | 12 | 6 | 4 | 2 | 1,600 |

---

## Issue Inventory

### #1: Implement dynamic slippage protection bounds check on MeridianRouter
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
The current MeridianRouter implementation verifies a basic minimum output amount, but lacks dynamic basis-point slippage protection based on real-time pool depth.

### Proposed Solution
Add a slippage threshold validator in `contracts/router/src/lib.rs` that calculates the maximum allowable deviation in basis points against expected output before routing to Soroswap.

### Acceptance Criteria
- [ ] Add `max_slippage_bps` parameter in `CrossChainIntent`
- [ ] Calculate price impact threshold in `execute_intent`
- [ ] Revert with `RouterError::SlippageExceeded` if execution violates the bound
- [ ] Add unit test in `test.rs` covering high price impact scenarios

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #2: Add reentrancy guard mechanism to execute_intent in MeridianRouter
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
Cross-contract calls to Soroswap and external yield vaults introduce reentrancy risks if an untrusted contract interacts with the router state before execution completes.

### Proposed Solution
Introduce a mutex state flag (`DataKey::Locked`) stored in Soroban instance storage that is checked and flipped during invocation.

### Acceptance Criteria
- [ ] Define `DataKey::Locked` in `types.rs`
- [ ] Check mutex state at start of `execute_intent` and release on exit
- [ ] Ensure mutex releases even on early error return
- [ ] Add unit test simulating reentrancy attempt

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #3: Support multi-hop route execution with 3+ intermediate pools on Soroban
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
Direct pairs for exotic Stellar assets and RWAs often do not exist with USDC. Swaps must route through intermediate pools (e.g. USDC -> XLM -> AQUA -> Target Asset).

### Proposed Solution
Enhance `MeridianRouter` to accept an arbitrary array of token addresses in `swap_path` and validate each hop against Soroswap pool existence before executing.

### Acceptance Criteria
- [ ] Support vector paths with length >= 2
- [ ] Validate intermediate token balances between hops
- [ ] Ensure intermediate tokens are not drained or retained in contract
- [ ] Add test for 3-hop swap execution with mock pool pairs

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #4: Implement deadline extension mechanism with timelocked admin recovery
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
If a cross-chain transfer experiences severe network congestion on the source chain, the transaction deadline on Stellar may expire before the relayer can submit it.

### Proposed Solution
Add an emergency recovery method `recover_expired_intent` allowing the sender or designated recipient to recover funds after a 48-hour timelock.

### Acceptance Criteria
- [ ] Implement `recover_expired_intent(message_hash, recipient)`
- [ ] Enforce 48-hour timelock past the original deadline
- [ ] Verify message has not already been processed
- [ ] Emit `IntentRecovered` event

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/errors.rs`
- `contracts/router/src/test.rs`

---
### #5: Create Soroban contract event schema for institutional audit trails
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
Institutional auditors require standardized, indexable event topics to track the lifecycle of tokenized assets and cross-chain fund movements.

### Proposed Solution
Standardize event topics across all contracts using typed symbols (`intent_submitted`, `swap_settled`, `vault_deposited`) containing ledger timestamp and sequence.

### Acceptance Criteria
- [ ] Define event schema structs in `types.rs`
- [ ] Publish structured topics in `execute_intent` and `route_to_vault`
- [ ] Verify event topic indexing in contract tests

### Files to Touch
- `contracts/router/src/types.rs`
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #6: Add emergency circuit breaker (pause_swaps / unpause_swaps)
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
If an exploit is detected in a connected DEX pool or bridge, the router must immediately halt new swap executions while preserving user withdrawal capabilities.

### Proposed Solution
Expose admin-controlled pause switches with fine-grained control: pausing swaps while allowing direct USDC passthrough.

### Acceptance Criteria
- [ ] Add `pause_swaps` and `unpause_swaps` in `MeridianRouter`
- [ ] Verify admin signature requirement
- [ ] Revert `execute_intent` if paused with specific `RouterError::ContractPaused`
- [ ] Add unit test verifying unauthorized account cannot pause

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/errors.rs`
- `contracts/router/src/test.rs`

---
### #7: Implement custom error reporting for partial Soroswap route failures
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
When a Soroswap swap reverts, the router currently bubbles up a generic Soroban host error, making it difficult for the relayer and frontend to determine the cause.

### Proposed Solution
Catch invocations and map underlying Soroswap failure codes to distinct `RouterError` enum variants.

### Acceptance Criteria
- [ ] Add specific error codes in `errors.rs` for insufficient pool liquidity, deadline exceeded, and pair not found
- [ ] Map invoke contract errors to descriptive router errors
- [ ] Add test cases simulating failed pool calls

### Files to Touch
- `contracts/router/src/errors.rs`
- `contracts/router/src/lib.rs`

---
### #8: Support fee-on-transfer tokens inside MeridianRouter
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
Some experimental Stellar tokens or tax-bearing community tokens take a deduction upon transfer, which breaks naive accounting assumptions of `amount_in == balance_delta`.

### Proposed Solution
Record contract token balance before and after token transfers to compute actual received amounts dynamically.

### Acceptance Criteria
- [ ] Query balance before and after `transfer`
- [ ] Use delta for downstream swap amount calculations
- [ ] Handle potential precision truncation gracefully
- [ ] Add unit tests simulating a 1% fee-on-transfer mock token

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #9: Create Soroban mock contracts for SoroswapRouter for unit testing
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
Unit tests currently rely on generic contract IDs, which prevents testing real swap balance changes and return vectors in isolated test environments.

### Proposed Solution
Create a lightweight `MockSoroswapRouter` contract in testutils that mimics the Soroswap Router trait and updates real mock token balances.

### Acceptance Criteria
- [ ] Implement `MockSoroswapRouter` with `swap_exact_tokens_for_tokens`
- [ ] Update mock token balances during swap execution
- [ ] Integrate into `contracts/router/src/test.rs`
- [ ] Enable end-to-end multi-token swap verification in test suite

### Files to Touch
- `contracts/router/src/test.rs`

---
### #10: Add gas consumption profiling for Soroban WASM execution
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
Soroban meters CPU instructions and memory consumption for every contract call. Inefficiencies can raise transaction fees for users.

### Proposed Solution
Create a profiling test script using Soroban SDK test utilities that logs CPU instructions and memory read/write bytes for key execution paths.

### Acceptance Criteria
- [ ] Implement benchmark tests using `env.budget()`
- [ ] Print CPU and memory metrics for single-hop vs multi-hop intent
- [ ] Ensure total CPU consumption remains under 2,000,000 instructions
- [ ] Document gas baseline in `ARCHITECTURE.md`

### Files to Touch
- `contracts/router/src/test.rs`
- `ARCHITECTURE.md`

---
### #11: Implement time-weighted average price (TWAP) oracle verification hook
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
Flash loan attacks or temporary low liquidity on AMM pools could distort spot prices and cause large slippage for incoming cross-chain users.

### Proposed Solution
Integrate an optional TWAP oracle verification interface that checks spot swap output against a trusted price oracle window before executing.

### Acceptance Criteria
- [ ] Define `OracleTrait` interface in router
- [ ] Query oracle price before invoking pool swap
- [ ] Revert if spot execution price deviates by more than 3% from oracle price
- [ ] Add unit tests with mock oracle

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #12: Create admin role delegation using Soroban custom authorization
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
A single admin address creates operational bottlenecks when managing multiple router functions (parameter updates vs pausing vs emergency withdrawals).

### Proposed Solution
Implement role-based authorization separating `OPERATOR_ROLE` (can pause/unpause), `FEE_MANAGER_ROLE` (can update relayer fee caps), and `SUPER_ADMIN` (can upgrade contract).

### Acceptance Criteria
- [ ] Define roles enum in `types.rs`
- [ ] Implement `grant_role` and `revoke_role`
- [ ] Enforce specific role requirement on router functions
- [ ] Add unit tests testing role boundaries

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #13: Implement atomic batch intent execution (execute_batch_intents)
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
Relayers submitting individual transactions for every incoming cross-chain intent consume unnecessary envelope overhead on the Stellar ledger.

### Proposed Solution
Add `execute_batch_intents(Vec<CrossChainIntent>, Vec<BytesN<32>>, relayer)` to process multiple cross-chain settlements in a single atomic invocation.

### Acceptance Criteria
- [ ] Process up to 5 intents in a single call
- [ ] If an individual swap fails due to slippage, skip without reverting the entire batch
- [ ] Emit batch summary events with success/failure bitmap
- [ ] Add unit tests for batch execution

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #14: Add non-custodial token recovery function for accidental deposits
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
Users occasionally transfer arbitrary tokens directly to contract addresses without calling the intent execution methods, causing stuck balances.

### Proposed Solution
Expose an admin-controlled recovery function allowing stuck tokens (excluding USDC and operational reserves) to be returned to verified owners.

### Acceptance Criteria
- [ ] Implement `rescue_tokens(token, to, amount)`
- [ ] Prevent rescue of locked user collateral or active USDC deposits
- [ ] Require `admin.require_auth()`
- [ ] Add unit tests verifying unauthorized caller is rejected

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #15: Implement contract upgradeability pattern using Soroban state migration
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
As the protocol evolves and connects with new bridges or DEXes, the router contract WASM must be upgradeable without losing configuration and processed message state.

### Proposed Solution
Implement the standard Soroban upgrade method `upgrade(env, new_wasm_hash)` with admin authorization and state compatibility verification.

### Acceptance Criteria
- [ ] Add `upgrade` function in `MeridianRouter`
- [ ] Enforce admin multi-sig or timelocked auth
- [ ] Verify instance storage persists through WASM upgrade in test suite
- [ ] Emit `ContractUpgraded(new_wasm_hash)` event

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #16: Optimize Soroban temporary vs persistent storage usage in MeridianRouter
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
Soroban temporary storage is significantly cheaper in rent fees than persistent storage, but has a TTL that must be bumped if needed.

### Proposed Solution
Audit storage keys: keep immutable config in instance storage, migrate `ProcessedMessage` hashes to temporary storage with automated TTL bumping.

### Acceptance Criteria
- [ ] Move replay protection hashes to temporary storage
- [ ] Extend TTL by 500,000 ledgers upon creation
- [ ] Benchmark state rent reduction
- [ ] Verify test suite passes with storage tier separation

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`

---
### #17: Add contract telemetry and execution metrics logging
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
Off-chain indexers need easy access to transaction throughput, volume transferred, and cumulative fees generated without re-parsing raw transaction envelopes.

### Proposed Solution
Implement contract-level counters that increment on every successful intent execution and expose public view methods.

### Acceptance Criteria
- [ ] Add `total_volume_usdc` and `total_intents_executed` counters
- [ ] Increment in `execute_intent`
- [ ] Expose `get_telemetry() -> TelemetryStats`
- [ ] Add unit tests verifying counter increments

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #18: Support custom recipient memo attachment for Stellar classic accounts
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
When routing output to a centralized exchange (e.g. Binance, Coinbase) or classic Stellar wallet, an integer or text memo is required to credit the end-user.

### Proposed Solution
Extend `CrossChainIntent` to support optional memo payloads and forward them when transferring output tokens to classic Stellar accounts.

### Acceptance Criteria
- [ ] Add `memo: Option<Bytes>` in `CrossChainIntent`
- [ ] Validate memo format (Id, Text, or Hash)
- [ ] Test transferring to simulated exchange address with memo verification

### Files to Touch
- `contracts/router/src/types.rs`
- `contracts/router/src/lib.rs`
- `contracts/router/src/test.rs`

---
### #19: Implement fractional relayer fee calculation with overflow protection
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
Relayer fee arithmetic using 128-bit integers must be strictly protected against multiplication overflows and division-by-zero errors.

### Proposed Solution
Use checked math (`checked_mul`, `checked_div`) for fee basis points calculations, with fallback error codes.

### Acceptance Criteria
- [ ] Replace standard arithmetic operators with checked math methods
- [ ] Add unit test with maximum i128 values verifying safe error return
- [ ] Document fee formula in code comments

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/errors.rs`

---
### #20: Add support for Phoenix DEX CLMM pool swaps in routing logic
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
Phoenix DEX provides Concentrated Liquidity Market Maker (CLMM) pools on Soroban which often offer lower slippage for stablecoin and RWA pairs than standard constant-product AMMs.

### Proposed Solution
Add an adapter in `MeridianRouter` to route trades through Phoenix CLMM pools when selected in the swap path.

### Acceptance Criteria
- [ ] Define `PhoenixRouterClient` trait interface
- [ ] Implement conditional branch in routing logic for CLMM swap execution
- [ ] Verify slippage bounds on CLMM tick ranges
- [ ] Add unit test with mock Phoenix pool

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #21: Implement maximum trade size restrictions per transaction
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
During initial mainnet launch, protocol risk should be mitigated by capping the maximum volume allowed per single cross-chain intent.

### Proposed Solution
Add an admin-configurable `max_trade_size_usdc` parameter to `RouterConfig` that rejects oversized transactions.

### Acceptance Criteria
- [ ] Add `max_trade_size` in `RouterConfig`
- [ ] Validate `intent.amount_in <= config.max_trade_size`
- [ ] Expose admin method `set_max_trade_size(new_size)`
- [ ] Add unit tests for boundary checks

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #22: Add rate-limiting per account on Soroban contract level
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
Malicious actors could spam small transactions to overwhelm the relayer and deplete Paymaster reserves.

### Proposed Solution
Implement a sliding-window rate limiter tracking transaction frequency per destination address within a given ledger block window.

### Acceptance Criteria
- [ ] Store last execution ledger sequence per user
- [ ] Enforce minimum ledger delay between consecutive executions
- [ ] Allow admin accounts to bypass rate limits
- [ ] Add unit test verifying rate limit triggering and cooldown

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/types.rs`
- `contracts/router/src/test.rs`

---
### #23: Implement minimum liquidity threshold verification before pool swap
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `contracts`

### Problem
If a Soroswap pool has drained or been manipulated, executing a swap can result in catastrophic slippage even with static min_out checks.

### Proposed Solution
Query total pool reserve depth before executing the swap, reverting if the swap size exceeds 10% of total pool reserves.

### Acceptance Criteria
- [ ] Fetch pool reserves before swap execution
- [ ] Check swap size to reserve ratio <= 10%
- [ ] Return descriptive error `RouterError::InsufficientPoolLiquidity`
- [ ] Add unit test with shallow mock pool

### Files to Touch
- `contracts/router/src/lib.rs`
- `contracts/router/src/errors.rs`
- `contracts/router/src/test.rs`

---
### #24: Add unit tests for zero-amount edge cases and underflow attacks
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `contracts`

### Problem
Malicious input payloads with zero amounts or negative numbers could trigger unexpected arithmetic states.

### Proposed Solution
Exhaustively test all contract entrypoints with 0, negative values, and minimum boundary integers.

### Acceptance Criteria
- [ ] Test `execute_intent` with `amount_in = 0`
- [ ] Test `execute_intent` with `min_amount_out = 0`
- [ ] Test `relayer_fee > amount_in`
- [ ] Verify all test cases revert with expected error enums

### Files to Touch
- `contracts/router/src/test.rs`

---
### #25: Implement formal verification specifications using Certora/SMT-solver
* **Category**: Smart Contracts (Soroban & Rust)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `contracts`

### Problem
Mission-critical financial contracts managing multi-million-dollar cross-chain transfers require formal proof that invariant rules cannot be broken.

### Proposed Solution
Write formal verification rules proving: 1) Contract token balance is strictly conserved, 2) Funds are never transferred without authorization, 3) Processed messages cannot be replayed.

### Acceptance Criteria
- [ ] Write property specifications in CVL or Rust invariant assertions
- [ ] Run automated SMT-solver verification
- [ ] Document verified invariants in `SECURITY.md`

### Files to Touch
- `contracts/router/src/test.rs`
- `SECURITY.md`

---
### #26: Implement automated rebalancing trigger based on accumulated USDC threshold
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Implement automated rebalancing trigger based on accumulated USDC threshold within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #27: Add support for alternative fee tokens (e.g. EURC) in MeridianPaymaster
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Add support for alternative fee tokens (e.g. EURC) in MeridianPaymaster within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #28: Create daily sponsorship quotas per recipient address to prevent sybil drain
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Create daily sponsorship quotas per recipient address to prevent sybil drain within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #29: Implement fee markup discount tiers for high-volume traders
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Implement fee markup discount tiers for high-volume traders within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #30: Add admin withdrawal function for surplus XLM in Paymaster
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Add admin withdrawal function for surplus XLM in Paymaster within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #31: Create Paymaster telemetry event emitting gas saved per transaction
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Create Paymaster telemetry event emitting gas saved per transaction within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #32: Implement signature-based fee sponsorship voucher verification
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `paymaster`

### Overview
Implement signature-based fee sponsorship voucher verification within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #33: Add unit tests for Paymaster rebalance with negative slippage
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Add unit tests for Paymaster rebalance with negative slippage within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #34: Create Soroban simulation tool for estimating exact envelope gas costs
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Create Soroban simulation tool for estimating exact envelope gas costs within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #35: Implement dynamic fee bumping for congested Stellar ledger blocks
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `paymaster`

### Overview
Implement dynamic fee bumping for congested Stellar ledger blocks within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #36: Add multi-sig admin authorization for Paymaster parameter updates
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Add multi-sig admin authorization for Paymaster parameter updates within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #37: Implement health-check endpoint for Paymaster operational reserves
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Implement health-check endpoint for Paymaster operational reserves within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #38: Create low-balance alert webhook service for Paymaster XLM pool
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Create low-balance alert webhook service for Paymaster XLM pool within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #39: Add unit tests for Paymaster initialization re-entry prevention
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Add unit tests for Paymaster initialization re-entry prevention within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #40: Implement fallback gas sponsor address in case primary pool exhausts
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Implement fallback gas sponsor address in case primary pool exhausts within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #41: Create benchmark report for Paymaster invocation CPU and memory cost
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Create benchmark report for Paymaster invocation CPU and memory cost within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #42: Add support for sponsoring Soroban auth invocation trees
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `paymaster`

### Overview
Add support for sponsoring Soroban auth invocation trees within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #43: Implement fee rebate mechanism for failed destination transactions
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Implement fee rebate mechanism for failed destination transactions within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #44: Create Paymaster dashboard metrics exporter for Prometheus
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Create Paymaster dashboard metrics exporter for Prometheus within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #45: Implement automated top-up cron job from treasury reserves
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Implement automated top-up cron job from treasury reserves within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #46: Add unit tests for Paymaster multi-token fee recording
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Add unit tests for Paymaster multi-token fee recording within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #47: Implement whitelist of authorized relayers for fee sponsorship
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `paymaster`

### Overview
Implement whitelist of authorized relayers for fee sponsorship within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #48: Add unit tests verifying zero-XLM user cannot drain paymaster buffer
* **Category**: Paymaster & Zero-XLM Gasless Infrastructure
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `paymaster`

### Overview
Add unit tests verifying zero-XLM user cannot drain paymaster buffer within the **Paymaster & Zero-XLM Gasless Infrastructure** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #49: Implement country sanction whitelist/blacklist checks in MeridianCompliance
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `compliance`

### Overview
Implement country sanction whitelist/blacklist checks in MeridianCompliance within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #50: Add expiration timestamp check for KYC verification credentials
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Add expiration timestamp check for KYC verification credentials within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #51: Support batch KYC credential upload for institutional onboarding
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `compliance`

### Overview
Support batch KYC credential upload for institutional onboarding within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #52: Implement accredited investor verification flag checks
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Implement accredited investor verification flag checks within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #53: Add integration with on-chain identity attestations (e.g. Worldcoin / ONCHAINID)
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `compliance`

### Overview
Add integration with on-chain identity attestations (e.g. Worldcoin / ONCHAINID) within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #54: Implement SEP-8 regulated asset approval server callback interface
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `compliance`

### Overview
Implement SEP-8 regulated asset approval server callback interface within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #55: Create admin revocation mechanism for compromised compliance credentials
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Create admin revocation mechanism for compromised compliance credentials within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #56: Add zero-knowledge proof (ZKP) verification hook for privacy-preserving KYC
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `compliance`

### Overview
Add zero-knowledge proof (ZKP) verification hook for privacy-preserving KYC within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #57: Implement compliance audit trail event emission
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Implement compliance audit trail event emission within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #58: Add unit tests for expired KYC credential rejection
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Add unit tests for expired KYC credential rejection within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #59: Implement role-based access control for compliance officers
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `compliance`

### Overview
Implement role-based access control for compliance officers within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #60: Create compliance REST API gateway for institutional identity providers
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `compliance`

### Overview
Create compliance REST API gateway for institutional identity providers within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #61: Add verification status query helper in SDK
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Add verification status query helper in SDK within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #62: Implement jurisdiction-specific maximum holding limits on Soroban
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `compliance`

### Overview
Implement jurisdiction-specific maximum holding limits on Soroban within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #63: Add unit tests for country code ISO-3166 numeric validation
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Add unit tests for country code ISO-3166 numeric validation within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #64: Implement compliance fee discount for verified non-profit organizations
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Implement compliance fee discount for verified non-profit organizations within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #65: Create mock KYC attestation issuer for testnet rehearsals
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `compliance`

### Overview
Create mock KYC attestation issuer for testnet rehearsals within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #66: Add unit tests for compliance initialization access control
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Add unit tests for compliance initialization access control within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #67: Implement automated KYC expiration notifications via webhook
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `compliance`

### Overview
Implement automated KYC expiration notifications via webhook within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #68: Document compliance integration guide for institutional RWA issuers
* **Category**: Institutional Compliance & SEP-8 Gate
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `compliance`

### Overview
Document compliance integration guide for institutional RWA issuers within the **Institutional Compliance & SEP-8 Gate** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #69: Implement Circle CCTP attestation polling with exponential backoff
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Implement Circle CCTP attestation polling with exponential backoff within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #70: Add Allbridge Core fallback routing when CCTP route is congested
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `bridges`

### Overview
Add Allbridge Core fallback routing when CCTP route is congested within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #71: Implement LayerZero endpoint integration for non-EVM messaging
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `bridges`

### Overview
Implement LayerZero endpoint integration for non-EVM messaging within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #72: Add CCTP message hash validation before submission
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Add CCTP message hash validation before submission within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #73: Create dead-letter queue for failed cross-chain attestations
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Create dead-letter queue for failed cross-chain attestations within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #74: Implement Chainlink / Reflector price feed verification on Soroban
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `bridges`

### Overview
Implement Chainlink / Reflector price feed verification on Soroban within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #75: Add support for Solana CCTP domain (Domain 5) in SDK and Relayer
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `bridges`

### Overview
Add support for Solana CCTP domain (Domain 5) in SDK and Relayer within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #76: Implement Arbitrum CCTP fast-finality attestation listener
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Implement Arbitrum CCTP fast-finality attestation listener within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #77: Create cross-chain transaction receipt generator
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Create cross-chain transaction receipt generator within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #78: Add unit tests for CCTP domain ID translation
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Add unit tests for CCTP domain ID translation within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #79: Implement automated retry mechanism for stalled CCTP minting
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Implement automated retry mechanism for stalled CCTP minting within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #80: Add multi-bridge quote comparison engine in SDK
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Add multi-bridge quote comparison engine in SDK within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #81: Implement bridge fee estimation endpoint in relayer API
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Implement bridge fee estimation endpoint in relayer API within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #82: Create bridge status monitoring dashboard with uptime indicators
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Create bridge status monitoring dashboard with uptime indicators within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #83: Add unit tests for Allbridge messenger payload deserialization
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Add unit tests for Allbridge messenger payload deserialization within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #84: Implement bridge latency tracker across supported origin chains
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Implement bridge latency tracker across supported origin chains within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #85: Add cross-chain message replay test vectors
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Add cross-chain message replay test vectors within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #86: Implement automated alert for Circle Iris API rate-limiting
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Implement automated alert for Circle Iris API rate-limiting within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #87: Create mock CCTP transmitter for local sandbox testing
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Create mock CCTP transmitter for local sandbox testing within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #88: Add support for Base (Domain 6) and Polygon (Domain 7) domains
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Add support for Base (Domain 6) and Polygon (Domain 7) domains within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #89: Implement gas price oracle integration for origin EVM chains
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `bridges`

### Overview
Implement gas price oracle integration for origin EVM chains within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #90: Document cross-chain bridge security assumptions and threat model
* **Category**: Bridges & Cross-Chain Oracles
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `bridges`

### Overview
Document cross-chain bridge security assumptions and threat model within the **Bridges & Cross-Chain Oracles** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #91: Implement cross-chain route estimation caching layer
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Implement cross-chain route estimation caching layer within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #92: Add support for EIP-712 typed data signing in SDK
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Add support for EIP-712 typed data signing in SDK within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #93: Create transaction builder for Soroban execute_intent invocation
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sdk`

### Overview
Create transaction builder for Soroban execute_intent invocation within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #94: Implement automated slippage calculation based on pool depth
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Implement automated slippage calculation based on pool depth within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #95: Add helper to query Stellar account trustlines and balances
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Add helper to query Stellar account trustlines and balances within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #96: Implement WebSocket subscription for intent execution progress
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sdk`

### Overview
Implement WebSocket subscription for intent execution progress within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #97: Create TypeScript types for all Soroban contract events
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Create TypeScript types for all Soroban contract events within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #98: Add unit test suite with 90%+ code coverage for SDK
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Add unit test suite with 90%+ code coverage for SDK within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #99: Implement SDK error classes with human-readable error messages
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Implement SDK error classes with human-readable error messages within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #100: Add support for multiple Stellar RPC endpoints with automatic failover
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Add support for multiple Stellar RPC endpoints with automatic failover within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #101: Implement batch quoting method getQuotesForMultipleChains
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Implement batch quoting method getQuotesForMultipleChains within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #102: Create mock provider for offline SDK development
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Create mock provider for offline SDK development within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #103: Add gas estimation helper for origin chain transactions
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Add gas estimation helper for origin chain transactions within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #104: Implement automated NPM package build and release pipeline
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Implement automated NPM package build and release pipeline within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #105: Add browser and Node.js dual bundle configuration
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Add browser and Node.js dual bundle configuration within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #106: Implement SDK logging middleware with configurable log levels
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Implement SDK logging middleware with configurable log levels within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #107: Create code example for 1-click vault deposit in TypeScript
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Create code example for 1-click vault deposit in TypeScript within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #108: Add support for Ledger and Trezor hardware wallets in SDK
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sdk`

### Overview
Add support for Ledger and Trezor hardware wallets in SDK within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #109: Implement client-side transaction simulation before broadcast
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sdk`

### Overview
Implement client-side transaction simulation before broadcast within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #110: Add automated retry on transient Stellar RPC HTTP 504 errors
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Add automated retry on transient Stellar RPC HTTP 504 errors within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #111: Create helper to resolve Stellar federated addresses (name*domain.com)
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Create helper to resolve Stellar federated addresses (name*domain.com) within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #112: Add typed event listener for CrossChainSwapCompleted
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Add typed event listener for CrossChainSwapCompleted within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #113: Implement SDK documentation site using TypeDoc
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Implement SDK documentation site using TypeDoc within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #114: Add unit tests for CCTP message packing and unpacking
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sdk`

### Overview
Add unit tests for CCTP message packing and unpacking within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #115: Create CLI tool (meridian-cli) powered by the SDK
* **Category**: TypeScript SDK (@meridian-protocol/sdk)
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sdk`

### Overview
Create CLI tool (meridian-cli) powered by the SDK within the **TypeScript SDK (@meridian-protocol/sdk)** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #116: Implement Freighter wallet connection state persistence
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Implement Freighter wallet connection state persistence within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #117: Add MetaMask and Rainbow EVM wallet connection via Wagmi/Viem
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Add MetaMask and Rainbow EVM wallet connection via Wagmi/Viem within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #118: Create real-time cross-chain progress stepper modal
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Create real-time cross-chain progress stepper modal within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #119: Implement slippage tolerance customization settings modal
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Implement slippage tolerance customization settings modal within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #120: Add dark/light mode toggle with Tailwind theme extension
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Add dark/light mode toggle with Tailwind theme extension within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #121: Create responsive mobile navigation drawer
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Create responsive mobile navigation drawer within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #122: Implement transaction history drawer with local storage caching
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Implement transaction history drawer with local storage caching within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #123: Add token search and selection modal with search indexing
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Add token search and selection modal with search indexing within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #124: Implement price impact warning for high-slippage trades
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Implement price impact warning for high-slippage trades within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #125: Create interactive RWA vault detail page with historical APY charts
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `frontend`

### Overview
Create interactive RWA vault detail page with historical APY charts within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #126: Add copy-to-clipboard button for transaction hashes and addresses
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Add copy-to-clipboard button for transaction hashes and addresses within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #127: Implement toast notification system for transaction lifecycle
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Implement toast notification system for transaction lifecycle within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #128: Create animated loading skeletons for vault cards
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Create animated loading skeletons for vault cards within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #129: Add network switch prompt if user is on unsupported EVM chain
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Add network switch prompt if user is on unsupported EVM chain within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #130: Implement QR code scanner for recipient Stellar address input
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Implement QR code scanner for recipient Stellar address input within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #131: Create embeddable iframe widget of the swap interface
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `frontend`

### Overview
Create embeddable iframe widget of the swap interface within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #132: Add localization support (i18n) for Spanish, Portuguese, and French
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Add localization support (i18n) for Spanish, Portuguese, and French within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #133: Implement accessibility (a11y) improvements across all interactive elements
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Implement accessibility (a11y) improvements across all interactive elements within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #134: Create 404 and Error Boundary fallback pages
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Create 404 and Error Boundary fallback pages within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #135: Add performance optimization for Webpack/Next.js bundle splitting
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `frontend`

### Overview
Add performance optimization for Webpack/Next.js bundle splitting within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #136: Implement user feedback banner for testnet faucet availability
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Implement user feedback banner for testnet faucet availability within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #137: Create analytics tracker for conversion funnels (privacy-first)
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Create analytics tracker for conversion funnels (privacy-first) within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #138: Add visual tooltip explaining Zero-XLM gasless paymaster mechanism
* **Category**: Frontend UI/UX & Web3 Integrations
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `frontend`

### Overview
Add visual tooltip explaining Zero-XLM gasless paymaster mechanism within the **Frontend UI/UX & Web3 Integrations** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #139: Implement SEP-24 interactive deposit and withdrawal flow in frontend
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sep-fiat`

### Overview
Implement SEP-24 interactive deposit and withdrawal flow in frontend within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #140: Add SEP-6 programmatic fiat quote and fee querying
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sep-fiat`

### Overview
Add SEP-6 programmatic fiat quote and fee querying within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #141: Implement SEP-38 quote integration for local currency conversions
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sep-fiat`

### Overview
Implement SEP-38 quote integration for local currency conversions within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #142: Add SEP-10 stellar web authentication JWT handler
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sep-fiat`

### Overview
Add SEP-10 stellar web authentication JWT handler within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #143: Create off-ramp status polling service for local bank transfers
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sep-fiat`

### Overview
Create off-ramp status polling service for local bank transfers within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #144: Implement fallback escrow refund logic if fiat anchor fails disbursement
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sep-fiat`

### Overview
Implement fallback escrow refund logic if fiat anchor fails disbursement within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #145: Add support for Brazilian Pix off-ramps via Mercado Bitcoin anchor
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sep-fiat`

### Overview
Add support for Brazilian Pix off-ramps via Mercado Bitcoin anchor within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #146: Implement Nigerian Naira off-ramp flow via Cowrie / Yellow Card anchor
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `sep-fiat`

### Overview
Implement Nigerian Naira off-ramp flow via Cowrie / Yellow Card anchor within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #147: Add Colombian Peso (COP) anchor integration
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `sep-fiat`

### Overview
Add Colombian Peso (COP) anchor integration within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #148: Create comprehensive SEP integration testing guide
* **Category**: Fiat Off-Ramps & Stellar SEP Standards
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `sep-fiat`

### Overview
Create comprehensive SEP integration testing guide within the **Fiat Off-Ramps & Stellar SEP Standards** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #149: Set up GitHub Actions workflow for automated WASM contract optimization
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `devops-security`

### Overview
Set up GitHub Actions workflow for automated WASM contract optimization within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #150: Implement automated code formatting check with cargo fmt and prettier
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `devops-security`

### Overview
Implement automated code formatting check with cargo fmt and prettier within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #151: Create end-to-end integration test runner on Stellar Testnet
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `devops-security`

### Overview
Create end-to-end integration test runner on Stellar Testnet within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #152: Implement fuzz testing suite for Soroban contract entrypoints using cargo fuzz
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `HIGH` (200 Points)
* **Labels**: `Stellar Wave`, `complexity:high`, `devops-security`

### Overview
Implement fuzz testing suite for Soroban contract entrypoints using cargo fuzz within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #153: Add security vulnerability reporting policy (SECURITY.md)
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `devops-security`

### Overview
Add security vulnerability reporting policy (SECURITY.md) within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #154: Create Docker compose file for running local Stellar Quickstart & Relayer
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `devops-security`

### Overview
Create Docker compose file for running local Stellar Quickstart & Relayer within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #155: Write comprehensive developer tutorial: "Bridging from Base to Blend Vault"
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `devops-security`

### Overview
Write comprehensive developer tutorial: "Bridging from Base to Blend Vault" within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #156: Implement automated changelog generator using conventional commits
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `devops-security`

### Overview
Implement automated changelog generator using conventional commits within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #157: Create Postman/Insomnia collection for Relayer and RPC APIs
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `devops-security`

### Overview
Create Postman/Insomnia collection for Relayer and RPC APIs within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #158: Write security self-assessment and audit readiness report
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `devops-security`

### Overview
Write security self-assessment and audit readiness report within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #159: Create video demo script and pitch deck for Stellar Community Fund
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `TRIVIAL` (100 Points)
* **Labels**: `Stellar Wave`, `complexity:trivial`, `devops-security`

### Overview
Create video demo script and pitch deck for Stellar Community Fund within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
### #160: Set up automated Slack/Discord notification bot for Drips Wave PR merges
* **Category**: DevOps, Security, Testing & Documentation
* **Complexity**: `MEDIUM` (150 Points)
* **Labels**: `Stellar Wave`, `complexity:medium`, `devops-security`

### Overview
Set up automated Slack/Discord notification bot for Drips Wave PR merges within the **DevOps, Security, Testing & Documentation** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (`contracts.yml` and `sdk-and-web.yml`).

---
