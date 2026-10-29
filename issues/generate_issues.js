const fs = require('fs');
const path = require('path');

const categories = [
  {
    name: 'Smart Contracts (Soroban & Rust)',
    label: 'contracts',
    items: [
      {
        title: 'Implement dynamic slippage protection bounds check on MeridianRouter',
        complexity: 'medium',
        points: 150,
        body: `### Problem
The current MeridianRouter implementation verifies a basic minimum output amount, but lacks dynamic basis-point slippage protection based on real-time pool depth.

### Proposed Solution
Add a slippage threshold validator in \`contracts/router/src/lib.rs\` that calculates the maximum allowable deviation in basis points against expected output before routing to Soroswap.

### Acceptance Criteria
- [ ] Add \`max_slippage_bps\` parameter in \`CrossChainIntent\`
- [ ] Calculate price impact threshold in \`execute_intent\`
- [ ] Revert with \`RouterError::SlippageExceeded\` if execution violates the bound
- [ ] Add unit test in \`test.rs\` covering high price impact scenarios

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Add reentrancy guard mechanism to execute_intent in MeridianRouter',
        complexity: 'medium',
        points: 150,
        body: `### Problem
Cross-contract calls to Soroswap and external yield vaults introduce reentrancy risks if an untrusted contract interacts with the router state before execution completes.

### Proposed Solution
Introduce a mutex state flag (\`DataKey::Locked\`) stored in Soroban instance storage that is checked and flipped during invocation.

### Acceptance Criteria
- [ ] Define \`DataKey::Locked\` in \`types.rs\`
- [ ] Check mutex state at start of \`execute_intent\` and release on exit
- [ ] Ensure mutex releases even on early error return
- [ ] Add unit test simulating reentrancy attempt

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Support multi-hop route execution with 3+ intermediate pools on Soroban',
        complexity: 'high',
        points: 200,
        body: `### Problem
Direct pairs for exotic Stellar assets and RWAs often do not exist with USDC. Swaps must route through intermediate pools (e.g. USDC -> XLM -> AQUA -> Target Asset).

### Proposed Solution
Enhance \`MeridianRouter\` to accept an arbitrary array of token addresses in \`swap_path\` and validate each hop against Soroswap pool existence before executing.

### Acceptance Criteria
- [ ] Support vector paths with length >= 2
- [ ] Validate intermediate token balances between hops
- [ ] Ensure intermediate tokens are not drained or retained in contract
- [ ] Add test for 3-hop swap execution with mock pool pairs

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement deadline extension mechanism with timelocked admin recovery',
        complexity: 'medium',
        points: 150,
        body: `### Problem
If a cross-chain transfer experiences severe network congestion on the source chain, the transaction deadline on Stellar may expire before the relayer can submit it.

### Proposed Solution
Add an emergency recovery method \`recover_expired_intent\` allowing the sender or designated recipient to recover funds after a 48-hour timelock.

### Acceptance Criteria
- [ ] Implement \`recover_expired_intent(message_hash, recipient)\`
- [ ] Enforce 48-hour timelock past the original deadline
- [ ] Verify message has not already been processed
- [ ] Emit \`IntentRecovered\` event

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/errors.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Create Soroban contract event schema for institutional audit trails',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
Institutional auditors require standardized, indexable event topics to track the lifecycle of tokenized assets and cross-chain fund movements.

### Proposed Solution
Standardize event topics across all contracts using typed symbols (\`intent_submitted\`, \`swap_settled\`, \`vault_deposited\`) containing ledger timestamp and sequence.

### Acceptance Criteria
- [ ] Define event schema structs in \`types.rs\`
- [ ] Publish structured topics in \`execute_intent\` and \`route_to_vault\`
- [ ] Verify event topic indexing in contract tests

### Files to Touch
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Add emergency circuit breaker (pause_swaps / unpause_swaps)',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
If an exploit is detected in a connected DEX pool or bridge, the router must immediately halt new swap executions while preserving user withdrawal capabilities.

### Proposed Solution
Expose admin-controlled pause switches with fine-grained control: pausing swaps while allowing direct USDC passthrough.

### Acceptance Criteria
- [ ] Add \`pause_swaps\` and \`unpause_swaps\` in \`MeridianRouter\`
- [ ] Verify admin signature requirement
- [ ] Revert \`execute_intent\` if paused with specific \`RouterError::ContractPaused\`
- [ ] Add unit test verifying unauthorized account cannot pause

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/errors.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement custom error reporting for partial Soroswap route failures',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
When a Soroswap swap reverts, the router currently bubbles up a generic Soroban host error, making it difficult for the relayer and frontend to determine the cause.

### Proposed Solution
Catch invocations and map underlying Soroswap failure codes to distinct \`RouterError\` enum variants.

### Acceptance Criteria
- [ ] Add specific error codes in \`errors.rs\` for insufficient pool liquidity, deadline exceeded, and pair not found
- [ ] Map invoke contract errors to descriptive router errors
- [ ] Add test cases simulating failed pool calls

### Files to Touch
- \`contracts/router/src/errors.rs\`
- \`contracts/router/src/lib.rs\``
      },
      {
        title: 'Support fee-on-transfer tokens inside MeridianRouter',
        complexity: 'high',
        points: 200,
        body: `### Problem
Some experimental Stellar tokens or tax-bearing community tokens take a deduction upon transfer, which breaks naive accounting assumptions of \`amount_in == balance_delta\`.

### Proposed Solution
Record contract token balance before and after token transfers to compute actual received amounts dynamically.

### Acceptance Criteria
- [ ] Query balance before and after \`transfer\`
- [ ] Use delta for downstream swap amount calculations
- [ ] Handle potential precision truncation gracefully
- [ ] Add unit tests simulating a 1% fee-on-transfer mock token

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Create Soroban mock contracts for SoroswapRouter for unit testing',
        complexity: 'medium',
        points: 150,
        body: `### Problem
Unit tests currently rely on generic contract IDs, which prevents testing real swap balance changes and return vectors in isolated test environments.

### Proposed Solution
Create a lightweight \`MockSoroswapRouter\` contract in testutils that mimics the Soroswap Router trait and updates real mock token balances.

### Acceptance Criteria
- [ ] Implement \`MockSoroswapRouter\` with \`swap_exact_tokens_for_tokens\`
- [ ] Update mock token balances during swap execution
- [ ] Integrate into \`contracts/router/src/test.rs\`
- [ ] Enable end-to-end multi-token swap verification in test suite

### Files to Touch
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Add gas consumption profiling for Soroban WASM execution',
        complexity: 'medium',
        points: 150,
        body: `### Problem
Soroban meters CPU instructions and memory consumption for every contract call. Inefficiencies can raise transaction fees for users.

### Proposed Solution
Create a profiling test script using Soroban SDK test utilities that logs CPU instructions and memory read/write bytes for key execution paths.

### Acceptance Criteria
- [ ] Implement benchmark tests using \`env.budget()\`
- [ ] Print CPU and memory metrics for single-hop vs multi-hop intent
- [ ] Ensure total CPU consumption remains under 2,000,000 instructions
- [ ] Document gas baseline in \`ARCHITECTURE.md\`

### Files to Touch
- \`contracts/router/src/test.rs\`
- \`ARCHITECTURE.md\``
      },
      {
        title: 'Implement time-weighted average price (TWAP) oracle verification hook',
        complexity: 'high',
        points: 200,
        body: `### Problem
Flash loan attacks or temporary low liquidity on AMM pools could distort spot prices and cause large slippage for incoming cross-chain users.

### Proposed Solution
Integrate an optional TWAP oracle verification interface that checks spot swap output against a trusted price oracle window before executing.

### Acceptance Criteria
- [ ] Define \`OracleTrait\` interface in router
- [ ] Query oracle price before invoking pool swap
- [ ] Revert if spot execution price deviates by more than 3% from oracle price
- [ ] Add unit tests with mock oracle

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Create admin role delegation using Soroban custom authorization',
        complexity: 'medium',
        points: 150,
        body: `### Problem
A single admin address creates operational bottlenecks when managing multiple router functions (parameter updates vs pausing vs emergency withdrawals).

### Proposed Solution
Implement role-based authorization separating \`OPERATOR_ROLE\` (can pause/unpause), \`FEE_MANAGER_ROLE\` (can update relayer fee caps), and \`SUPER_ADMIN\` (can upgrade contract).

### Acceptance Criteria
- [ ] Define roles enum in \`types.rs\`
- [ ] Implement \`grant_role\` and \`revoke_role\`
- [ ] Enforce specific role requirement on router functions
- [ ] Add unit tests testing role boundaries

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement atomic batch intent execution (execute_batch_intents)',
        complexity: 'high',
        points: 200,
        body: `### Problem
Relayers submitting individual transactions for every incoming cross-chain intent consume unnecessary envelope overhead on the Stellar ledger.

### Proposed Solution
Add \`execute_batch_intents(Vec<CrossChainIntent>, Vec<BytesN<32>>, relayer)\` to process multiple cross-chain settlements in a single atomic invocation.

### Acceptance Criteria
- [ ] Process up to 5 intents in a single call
- [ ] If an individual swap fails due to slippage, skip without reverting the entire batch
- [ ] Emit batch summary events with success/failure bitmap
- [ ] Add unit tests for batch execution

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Add non-custodial token recovery function for accidental deposits',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
Users occasionally transfer arbitrary tokens directly to contract addresses without calling the intent execution methods, causing stuck balances.

### Proposed Solution
Expose an admin-controlled recovery function allowing stuck tokens (excluding USDC and operational reserves) to be returned to verified owners.

### Acceptance Criteria
- [ ] Implement \`rescue_tokens(token, to, amount)\`
- [ ] Prevent rescue of locked user collateral or active USDC deposits
- [ ] Require \`admin.require_auth()\`
- [ ] Add unit tests verifying unauthorized caller is rejected

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement contract upgradeability pattern using Soroban state migration',
        complexity: 'high',
        points: 200,
        body: `### Problem
As the protocol evolves and connects with new bridges or DEXes, the router contract WASM must be upgradeable without losing configuration and processed message state.

### Proposed Solution
Implement the standard Soroban upgrade method \`upgrade(env, new_wasm_hash)\` with admin authorization and state compatibility verification.

### Acceptance Criteria
- [ ] Add \`upgrade\` function in \`MeridianRouter\`
- [ ] Enforce admin multi-sig or timelocked auth
- [ ] Verify instance storage persists through WASM upgrade in test suite
- [ ] Emit \`ContractUpgraded(new_wasm_hash)\` event

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Optimize Soroban temporary vs persistent storage usage in MeridianRouter',
        complexity: 'medium',
        points: 150,
        body: `### Problem
Soroban temporary storage is significantly cheaper in rent fees than persistent storage, but has a TTL that must be bumped if needed.

### Proposed Solution
Audit storage keys: keep immutable config in instance storage, migrate \`ProcessedMessage\` hashes to temporary storage with automated TTL bumping.

### Acceptance Criteria
- [ ] Move replay protection hashes to temporary storage
- [ ] Extend TTL by 500,000 ledgers upon creation
- [ ] Benchmark state rent reduction
- [ ] Verify test suite passes with storage tier separation

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\``
      },
      {
        title: 'Add contract telemetry and execution metrics logging',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
Off-chain indexers need easy access to transaction throughput, volume transferred, and cumulative fees generated without re-parsing raw transaction envelopes.

### Proposed Solution
Implement contract-level counters that increment on every successful intent execution and expose public view methods.

### Acceptance Criteria
- [ ] Add \`total_volume_usdc\` and \`total_intents_executed\` counters
- [ ] Increment in \`execute_intent\`
- [ ] Expose \`get_telemetry() -> TelemetryStats\`
- [ ] Add unit tests verifying counter increments

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Support custom recipient memo attachment for Stellar classic accounts',
        complexity: 'medium',
        points: 150,
        body: `### Problem
When routing output to a centralized exchange (e.g. Binance, Coinbase) or classic Stellar wallet, an integer or text memo is required to credit the end-user.

### Proposed Solution
Extend \`CrossChainIntent\` to support optional memo payloads and forward them when transferring output tokens to classic Stellar accounts.

### Acceptance Criteria
- [ ] Add \`memo: Option<Bytes>\` in \`CrossChainIntent\`
- [ ] Validate memo format (Id, Text, or Hash)
- [ ] Test transferring to simulated exchange address with memo verification

### Files to Touch
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement fractional relayer fee calculation with overflow protection',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
Relayer fee arithmetic using 128-bit integers must be strictly protected against multiplication overflows and division-by-zero errors.

### Proposed Solution
Use checked math (\`checked_mul\`, \`checked_div\`) for fee basis points calculations, with fallback error codes.

### Acceptance Criteria
- [ ] Replace standard arithmetic operators with checked math methods
- [ ] Add unit test with maximum i128 values verifying safe error return
- [ ] Document fee formula in code comments

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/errors.rs\``
      },
      {
        title: 'Add support for Phoenix DEX CLMM pool swaps in routing logic',
        complexity: 'high',
        points: 200,
        body: `### Problem
Phoenix DEX provides Concentrated Liquidity Market Maker (CLMM) pools on Soroban which often offer lower slippage for stablecoin and RWA pairs than standard constant-product AMMs.

### Proposed Solution
Add an adapter in \`MeridianRouter\` to route trades through Phoenix CLMM pools when selected in the swap path.

### Acceptance Criteria
- [ ] Define \`PhoenixRouterClient\` trait interface
- [ ] Implement conditional branch in routing logic for CLMM swap execution
- [ ] Verify slippage bounds on CLMM tick ranges
- [ ] Add unit test with mock Phoenix pool

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement maximum trade size restrictions per transaction',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
During initial mainnet launch, protocol risk should be mitigated by capping the maximum volume allowed per single cross-chain intent.

### Proposed Solution
Add an admin-configurable \`max_trade_size_usdc\` parameter to \`RouterConfig\` that rejects oversized transactions.

### Acceptance Criteria
- [ ] Add \`max_trade_size\` in \`RouterConfig\`
- [ ] Validate \`intent.amount_in <= config.max_trade_size\`
- [ ] Expose admin method \`set_max_trade_size(new_size)\`
- [ ] Add unit tests for boundary checks

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Add rate-limiting per account on Soroban contract level',
        complexity: 'medium',
        points: 150,
        body: `### Problem
Malicious actors could spam small transactions to overwhelm the relayer and deplete Paymaster reserves.

### Proposed Solution
Implement a sliding-window rate limiter tracking transaction frequency per destination address within a given ledger block window.

### Acceptance Criteria
- [ ] Store last execution ledger sequence per user
- [ ] Enforce minimum ledger delay between consecutive executions
- [ ] Allow admin accounts to bypass rate limits
- [ ] Add unit test verifying rate limit triggering and cooldown

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/types.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement minimum liquidity threshold verification before pool swap',
        complexity: 'medium',
        points: 150,
        body: `### Problem
If a Soroswap pool has drained or been manipulated, executing a swap can result in catastrophic slippage even with static min_out checks.

### Proposed Solution
Query total pool reserve depth before executing the swap, reverting if the swap size exceeds 10% of total pool reserves.

### Acceptance Criteria
- [ ] Fetch pool reserves before swap execution
- [ ] Check swap size to reserve ratio <= 10%
- [ ] Return descriptive error \`RouterError::InsufficientPoolLiquidity\`
- [ ] Add unit test with shallow mock pool

### Files to Touch
- \`contracts/router/src/lib.rs\`
- \`contracts/router/src/errors.rs\`
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Add unit tests for zero-amount edge cases and underflow attacks',
        complexity: 'trivial',
        points: 100,
        body: `### Problem
Malicious input payloads with zero amounts or negative numbers could trigger unexpected arithmetic states.

### Proposed Solution
Exhaustively test all contract entrypoints with 0, negative values, and minimum boundary integers.

### Acceptance Criteria
- [ ] Test \`execute_intent\` with \`amount_in = 0\`
- [ ] Test \`execute_intent\` with \`min_amount_out = 0\`
- [ ] Test \`relayer_fee > amount_in\`
- [ ] Verify all test cases revert with expected error enums

### Files to Touch
- \`contracts/router/src/test.rs\``
      },
      {
        title: 'Implement formal verification specifications using Certora/SMT-solver',
        complexity: 'high',
        points: 200,
        body: `### Problem
Mission-critical financial contracts managing multi-million-dollar cross-chain transfers require formal proof that invariant rules cannot be broken.

### Proposed Solution
Write formal verification rules proving: 1) Contract token balance is strictly conserved, 2) Funds are never transferred without authorization, 3) Processed messages cannot be replayed.

### Acceptance Criteria
- [ ] Write property specifications in CVL or Rust invariant assertions
- [ ] Run automated SMT-solver verification
- [ ] Document verified invariants in \`SECURITY.md\`

### Files to Touch
- \`contracts/router/src/test.rs\`
- \`SECURITY.md\``
      }
    ]
  }
];

// Helper to generate remaining categories up to 155 issues
const otherCategories = [
  {
    name: 'Paymaster & Zero-XLM Gasless Infrastructure',
    label: 'paymaster',
    prefix: 'Paymaster',
    count: 23,
    startId: 26,
    templates: [
      { t: 'Implement automated rebalancing trigger based on accumulated USDC threshold', c: 'medium', p: 150 },
      { t: 'Add support for alternative fee tokens (e.g. EURC) in MeridianPaymaster', c: 'medium', p: 150 },
      { t: 'Create daily sponsorship quotas per recipient address to prevent sybil drain', c: 'medium', p: 150 },
      { t: 'Implement fee markup discount tiers for high-volume traders', c: 'trivial', p: 100 },
      { t: 'Add admin withdrawal function for surplus XLM in Paymaster', c: 'trivial', p: 100 },
      { t: 'Create Paymaster telemetry event emitting gas saved per transaction', c: 'trivial', p: 100 },
      { t: 'Implement signature-based fee sponsorship voucher verification', c: 'high', p: 200 },
      { t: 'Add unit tests for Paymaster rebalance with negative slippage', c: 'medium', p: 150 },
      { t: 'Create Soroban simulation tool for estimating exact envelope gas costs', c: 'medium', p: 150 },
      { t: 'Implement dynamic fee bumping for congested Stellar ledger blocks', c: 'high', p: 200 },
      { t: 'Add multi-sig admin authorization for Paymaster parameter updates', c: 'medium', p: 150 },
      { t: 'Implement health-check endpoint for Paymaster operational reserves', c: 'trivial', p: 100 },
      { t: 'Create low-balance alert webhook service for Paymaster XLM pool', c: 'trivial', p: 100 },
      { t: 'Add unit tests for Paymaster initialization re-entry prevention', c: 'trivial', p: 100 },
      { t: 'Implement fallback gas sponsor address in case primary pool exhausts', c: 'medium', p: 150 },
      { t: 'Create benchmark report for Paymaster invocation CPU and memory cost', c: 'trivial', p: 100 },
      { t: 'Add support for sponsoring Soroban auth invocation trees', c: 'high', p: 200 },
      { t: 'Implement fee rebate mechanism for failed destination transactions', c: 'medium', p: 150 },
      { t: 'Create Paymaster dashboard metrics exporter for Prometheus', c: 'medium', p: 150 },
      { t: 'Implement automated top-up cron job from treasury reserves', c: 'medium', p: 150 },
      { t: 'Add unit tests for Paymaster multi-token fee recording', c: 'trivial', p: 100 },
      { t: 'Implement whitelist of authorized relayers for fee sponsorship', c: 'trivial', p: 100 },
      { t: 'Add unit tests verifying zero-XLM user cannot drain paymaster buffer', c: 'medium', p: 150 },
    ]
  },
  {
    name: 'Institutional Compliance & SEP-8 Gate',
    label: 'compliance',
    prefix: 'Compliance',
    count: 20,
    startId: 49,
    templates: [
      { t: 'Implement country sanction whitelist/blacklist checks in MeridianCompliance', c: 'medium', p: 150 },
      { t: 'Add expiration timestamp check for KYC verification credentials', c: 'trivial', p: 100 },
      { t: 'Support batch KYC credential upload for institutional onboarding', c: 'medium', p: 150 },
      { t: 'Implement accredited investor verification flag checks', c: 'trivial', p: 100 },
      { t: 'Add integration with on-chain identity attestations (e.g. Worldcoin / ONCHAINID)', c: 'high', p: 200 },
      { t: 'Implement SEP-8 regulated asset approval server callback interface', c: 'high', p: 200 },
      { t: 'Create admin revocation mechanism for compromised compliance credentials', c: 'trivial', p: 100 },
      { t: 'Add zero-knowledge proof (ZKP) verification hook for privacy-preserving KYC', c: 'high', p: 200 },
      { t: 'Implement compliance audit trail event emission', c: 'trivial', p: 100 },
      { t: 'Add unit tests for expired KYC credential rejection', c: 'trivial', p: 100 },
      { t: 'Implement role-based access control for compliance officers', c: 'medium', p: 150 },
      { t: 'Create compliance REST API gateway for institutional identity providers', c: 'medium', p: 150 },
      { t: 'Add verification status query helper in SDK', c: 'trivial', p: 100 },
      { t: 'Implement jurisdiction-specific maximum holding limits on Soroban', c: 'high', p: 200 },
      { t: 'Add unit tests for country code ISO-3166 numeric validation', c: 'trivial', p: 100 },
      { t: 'Implement compliance fee discount for verified non-profit organizations', c: 'trivial', p: 100 },
      { t: 'Create mock KYC attestation issuer for testnet rehearsals', c: 'medium', p: 150 },
      { t: 'Add unit tests for compliance initialization access control', c: 'trivial', p: 100 },
      { t: 'Implement automated KYC expiration notifications via webhook', c: 'medium', p: 150 },
      { t: 'Document compliance integration guide for institutional RWA issuers', c: 'trivial', p: 100 },
    ]
  },
  {
    name: 'Bridges & Cross-Chain Oracles',
    label: 'bridges',
    prefix: 'Bridges',
    count: 22,
    startId: 69,
    templates: [
      { t: 'Implement Circle CCTP attestation polling with exponential backoff', c: 'medium', p: 150 },
      { t: 'Add Allbridge Core fallback routing when CCTP route is congested', c: 'high', p: 200 },
      { t: 'Implement LayerZero endpoint integration for non-EVM messaging', c: 'high', p: 200 },
      { t: 'Add CCTP message hash validation before submission', c: 'trivial', p: 100 },
      { t: 'Create dead-letter queue for failed cross-chain attestations', c: 'medium', p: 150 },
      { t: 'Implement Chainlink / Reflector price feed verification on Soroban', c: 'high', p: 200 },
      { t: 'Add support for Solana CCTP domain (Domain 5) in SDK and Relayer', c: 'high', p: 200 },
      { t: 'Implement Arbitrum CCTP fast-finality attestation listener', c: 'medium', p: 150 },
      { t: 'Create cross-chain transaction receipt generator', c: 'trivial', p: 100 },
      { t: 'Add unit tests for CCTP domain ID translation', c: 'trivial', p: 100 },
      { t: 'Implement automated retry mechanism for stalled CCTP minting', c: 'medium', p: 150 },
      { t: 'Add multi-bridge quote comparison engine in SDK', c: 'medium', p: 150 },
      { t: 'Implement bridge fee estimation endpoint in relayer API', c: 'trivial', p: 100 },
      { t: 'Create bridge status monitoring dashboard with uptime indicators', c: 'medium', p: 150 },
      { t: 'Add unit tests for Allbridge messenger payload deserialization', c: 'trivial', p: 100 },
      { t: 'Implement bridge latency tracker across supported origin chains', c: 'trivial', p: 100 },
      { t: 'Add cross-chain message replay test vectors', c: 'medium', p: 150 },
      { t: 'Implement automated alert for Circle Iris API rate-limiting', c: 'trivial', p: 100 },
      { t: 'Create mock CCTP transmitter for local sandbox testing', c: 'medium', p: 150 },
      { t: 'Add support for Base (Domain 6) and Polygon (Domain 7) domains', c: 'medium', p: 150 },
      { t: 'Implement gas price oracle integration for origin EVM chains', c: 'medium', p: 150 },
      { t: 'Document cross-chain bridge security assumptions and threat model', c: 'trivial', p: 100 },
    ]
  },
  {
    name: 'TypeScript SDK (@meridian-protocol/sdk)',
    label: 'sdk',
    prefix: 'SDK',
    count: 25,
    startId: 91,
    templates: [
      { t: 'Implement cross-chain route estimation caching layer', c: 'medium', p: 150 },
      { t: 'Add support for EIP-712 typed data signing in SDK', c: 'medium', p: 150 },
      { t: 'Create transaction builder for Soroban execute_intent invocation', c: 'high', p: 200 },
      { t: 'Implement automated slippage calculation based on pool depth', c: 'medium', p: 150 },
      { t: 'Add helper to query Stellar account trustlines and balances', c: 'trivial', p: 100 },
      { t: 'Implement WebSocket subscription for intent execution progress', c: 'high', p: 200 },
      { t: 'Create TypeScript types for all Soroban contract events', c: 'trivial', p: 100 },
      { t: 'Add unit test suite with 90%+ code coverage for SDK', c: 'medium', p: 150 },
      { t: 'Implement SDK error classes with human-readable error messages', c: 'trivial', p: 100 },
      { t: 'Add support for multiple Stellar RPC endpoints with automatic failover', c: 'medium', p: 150 },
      { t: 'Implement batch quoting method getQuotesForMultipleChains', c: 'medium', p: 150 },
      { t: 'Create mock provider for offline SDK development', c: 'trivial', p: 100 },
      { t: 'Add gas estimation helper for origin chain transactions', c: 'trivial', p: 100 },
      { t: 'Implement automated NPM package build and release pipeline', c: 'trivial', p: 100 },
      { t: 'Add browser and Node.js dual bundle configuration', c: 'trivial', p: 100 },
      { t: 'Implement SDK logging middleware with configurable log levels', c: 'trivial', p: 100 },
      { t: 'Create code example for 1-click vault deposit in TypeScript', c: 'trivial', p: 100 },
      { t: 'Add support for Ledger and Trezor hardware wallets in SDK', c: 'high', p: 200 },
      { t: 'Implement client-side transaction simulation before broadcast', c: 'medium', p: 150 },
      { t: 'Add automated retry on transient Stellar RPC HTTP 504 errors', c: 'trivial', p: 100 },
      { t: 'Create helper to resolve Stellar federated addresses (name*domain.com)', c: 'trivial', p: 100 },
      { t: 'Add typed event listener for CrossChainSwapCompleted', c: 'trivial', p: 100 },
      { t: 'Implement SDK documentation site using TypeDoc', c: 'trivial', p: 100 },
      { t: 'Add unit tests for CCTP message packing and unpacking', c: 'trivial', p: 100 },
      { t: 'Create CLI tool (meridian-cli) powered by the SDK', c: 'high', p: 200 },
    ]
  },
  {
    name: 'Frontend UI/UX & Web3 Integrations',
    label: 'frontend',
    prefix: 'Frontend',
    count: 23,
    startId: 116,
    templates: [
      { t: 'Implement Freighter wallet connection state persistence', c: 'trivial', p: 100 },
      { t: 'Add MetaMask and Rainbow EVM wallet connection via Wagmi/Viem', c: 'medium', p: 150 },
      { t: 'Create real-time cross-chain progress stepper modal', c: 'medium', p: 150 },
      { t: 'Implement slippage tolerance customization settings modal', c: 'trivial', p: 100 },
      { t: 'Add dark/light mode toggle with Tailwind theme extension', c: 'trivial', p: 100 },
      { t: 'Create responsive mobile navigation drawer', c: 'trivial', p: 100 },
      { t: 'Implement transaction history drawer with local storage caching', c: 'medium', p: 150 },
      { t: 'Add token search and selection modal with search indexing', c: 'medium', p: 150 },
      { t: 'Implement price impact warning for high-slippage trades', c: 'trivial', p: 100 },
      { t: 'Create interactive RWA vault detail page with historical APY charts', c: 'high', p: 200 },
      { t: 'Add copy-to-clipboard button for transaction hashes and addresses', c: 'trivial', p: 100 },
      { t: 'Implement toast notification system for transaction lifecycle', c: 'trivial', p: 100 },
      { t: 'Create animated loading skeletons for vault cards', c: 'trivial', p: 100 },
      { t: 'Add network switch prompt if user is on unsupported EVM chain', c: 'trivial', p: 100 },
      { t: 'Implement QR code scanner for recipient Stellar address input', c: 'medium', p: 150 },
      { t: 'Create embeddable iframe widget of the swap interface', c: 'high', p: 200 },
      { t: 'Add localization support (i18n) for Spanish, Portuguese, and French', c: 'medium', p: 150 },
      { t: 'Implement accessibility (a11y) improvements across all interactive elements', c: 'trivial', p: 100 },
      { t: 'Create 404 and Error Boundary fallback pages', c: 'trivial', p: 100 },
      { t: 'Add performance optimization for Webpack/Next.js bundle splitting', c: 'medium', p: 150 },
      { t: 'Implement user feedback banner for testnet faucet availability', c: 'trivial', p: 100 },
      { t: 'Create analytics tracker for conversion funnels (privacy-first)', c: 'trivial', p: 100 },
      { t: 'Add visual tooltip explaining Zero-XLM gasless paymaster mechanism', c: 'trivial', p: 100 },
    ]
  },
  {
    name: 'Fiat Off-Ramps & Stellar SEP Standards',
    label: 'sep-fiat',
    prefix: 'Fiat/SEP',
    count: 10,
    startId: 139,
    templates: [
      { t: 'Implement SEP-24 interactive deposit and withdrawal flow in frontend', c: 'high', p: 200 },
      { t: 'Add SEP-6 programmatic fiat quote and fee querying', c: 'medium', p: 150 },
      { t: 'Implement SEP-38 quote integration for local currency conversions', c: 'high', p: 200 },
      { t: 'Add SEP-10 stellar web authentication JWT handler', c: 'medium', p: 150 },
      { t: 'Create off-ramp status polling service for local bank transfers', c: 'medium', p: 150 },
      { t: 'Implement fallback escrow refund logic if fiat anchor fails disbursement', c: 'high', p: 200 },
      { t: 'Add support for Brazilian Pix off-ramps via Mercado Bitcoin anchor', c: 'high', p: 200 },
      { t: 'Implement Nigerian Naira off-ramp flow via Cowrie / Yellow Card anchor', c: 'high', p: 200 },
      { t: 'Add Colombian Peso (COP) anchor integration', c: 'medium', p: 150 },
      { t: 'Create comprehensive SEP integration testing guide', c: 'trivial', p: 100 },
    ]
  },
  {
    name: 'DevOps, Security, Testing & Documentation',
    label: 'devops-security',
    prefix: 'DevOps',
    count: 12,
    startId: 149,
    templates: [
      { t: 'Set up GitHub Actions workflow for automated WASM contract optimization', c: 'trivial', p: 100 },
      { t: 'Implement automated code formatting check with cargo fmt and prettier', c: 'trivial', p: 100 },
      { t: 'Create end-to-end integration test runner on Stellar Testnet', c: 'high', p: 200 },
      { t: 'Implement fuzz testing suite for Soroban contract entrypoints using cargo fuzz', c: 'high', p: 200 },
      { t: 'Add security vulnerability reporting policy (SECURITY.md)', c: 'trivial', p: 100 },
      { t: 'Create Docker compose file for running local Stellar Quickstart & Relayer', c: 'medium', p: 150 },
      { t: 'Write comprehensive developer tutorial: "Bridging from Base to Blend Vault"', c: 'medium', p: 150 },
      { t: 'Implement automated changelog generator using conventional commits', c: 'trivial', p: 100 },
      { t: 'Create Postman/Insomnia collection for Relayer and RPC APIs', c: 'trivial', p: 100 },
      { t: 'Write security self-assessment and audit readiness report', c: 'medium', p: 150 },
      { t: 'Create video demo script and pitch deck for Stellar Community Fund', c: 'trivial', p: 100 },
      { t: 'Set up automated Slack/Discord notification bot for Drips Wave PR merges', c: 'medium', p: 150 },
    ]
  }
];

let allIssues = [];

// Add Category 1 items
categories[0].items.forEach((item, idx) => {
  allIssues.push({
    id: idx + 1,
    title: item.title,
    category: categories[0].name,
    complexity: item.complexity,
    points: item.points,
    labels: ['Stellar Wave', `complexity:${item.complexity}`, categories[0].label],
    body: item.body
  });
});

// Add remaining categories
otherCategories.forEach(cat => {
  cat.templates.forEach((tmpl, idx) => {
    const issueId = cat.startId + idx;
    allIssues.push({
      id: issueId,
      title: tmpl.t,
      category: cat.name,
      complexity: tmpl.c,
      points: tmpl.p,
      labels: ['Stellar Wave', `complexity:${tmpl.c}`, cat.label],
      body: `### Overview
${tmpl.t} within the **${cat.name}** module of Meridian Protocol.

### Objectives & Deliverables
- [ ] Implement the designated functionality in according to protocol specifications
- [ ] Include unit / integration tests verifying core and boundary behaviors
- [ ] Update corresponding documentation and developer guides
- [ ] Pass all CI test gates without warnings

### Verification
All code changes must pass the automated GitHub Actions CI suite (\`contracts.yml\` and \`sdk-and-web.yml\`).`
    });
  });
});

console.log(`Generated ${allIssues.length} total issues.`);

// Write issues.json
fs.writeFileSync(
  path.join(__dirname, 'issues.json'),
  JSON.stringify(allIssues, null, 2),
  'utf-8'
);

// Write ISSUES_CATALOG.md
let catalogMd = `# Meridian Protocol — Complete Issue Catalog (Drips Wave Backlog)

Total Curated Issues: **${allIssues.length}**  
Total Potential Points: **${allIssues.reduce((acc, i) => acc + i.points, 0).toLocaleString()} Points**

---

## Breakdown by Track & Complexity

| Category | Total Issues | Trivial (100 Pts) | Medium (150 Pts) | High (200 Pts) | Category Points |
| :--- | :---: | :---: | :---: | :---: | :---: |
`;

const catSummary = {};
allIssues.forEach(i => {
  if (!catSummary[i.category]) {
    catSummary[i.category] = { total: 0, trivial: 0, medium: 0, high: 0, points: 0 };
  }
  catSummary[i.category].total++;
  catSummary[i.category][i.complexity]++;
  catSummary[i.category].points += i.points;
});

Object.entries(catSummary).forEach(([name, s]) => {
  catalogMd += `| **${name}** | ${s.total} | ${s.trivial} | ${s.medium} | ${s.high} | ${s.points.toLocaleString()} |\n`;
});

catalogMd += `\n---\n\n## Issue Inventory\n\n`;

allIssues.forEach(issue => {
  catalogMd += `### #${issue.id}: ${issue.title}
* **Category**: ${issue.category}
* **Complexity**: \`${issue.complexity.toUpperCase()}\` (${issue.points} Points)
* **Labels**: \`${issue.labels.join('`, `')}\`

${issue.body}

---
`;
});

fs.writeFileSync(
  path.join(__dirname, 'ISSUES_CATALOG.md'),
  catalogMd,
  'utf-8'
);

console.log('Successfully wrote issues.json and ISSUES_CATALOG.md');
