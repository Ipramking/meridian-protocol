# Meridian Protocol Architecture Specification

## 1. System Overview
Meridian Protocol is designed to bridge external blockchain liquidity directly into Stellar’s Soroban smart contract ecosystem, with a specialized focus on Real-World Assets (RWAs), money market yields, and cross-border fiat anchors.

---

## 2. Smart Contract Primitives

### 2.1 `MeridianRouter`
* **Address (Stellar Mainnet)**: `CDMERIDIAN7Z5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPN`
* **Responsibilities**:
  * Acts as recipient for Circle CCTP inbound minting via `CctpForwarder`.
  * Verifies replay protection against `ProcessedMessage(BytesN<32>)`.
  * Deducts relayer/paymaster reimbursement fee.
  * Dynamically queries `SoroswapRouter` / `AggregatorV3` for token swapping.
  * Dispatches tokens to target contracts implementing the Soroban Vault interface (`deposit(amount, recipient)`).

### 2.2 `MeridianPaymaster`
* **Responsibilities**:
  * Solves the "Zero-XLM" cold-start dilemma for non-Stellar users.
  * Maintains an operational reserve of XLM to sponsor transaction envelope gas fees.
  * Reimburses itself via fractional USDC deductions from swapped capital.
  * Implements periodic automated rebalancing: sells collected USDC fees back into XLM via Soroswap AMM pools.

### 2.3 `MeridianCompliance`
* **Responsibilities**:
  * Enforces SEP-8 regulated asset compliance on Soroban.
  * Restricts access to permissioned institutional RWA vaults based on verifiable identity credentials and country whitelists.

---

## 3. Relayer & Cross-Chain Lifecycle

```
1. User Signature:
   User signs EIP-712 CrossChainIntent on Arbitrum/Base specifying:
   - recipient: Stellar public key (G...)
   - min_amount_out: slippage floor
   - target_vault: (optional) RWA pool address

2. Source Deposit:
   Client calls Circle CCTP TokenMessenger.depositForBurn() with:
   - destinationDomain: 27 (Stellar)
   - mintRecipient: MeridianRouter contract address

3. Attestation Polling:
   Meridian Relayer polls Circle Iris API (/v1/attestations/{message_hash})
   until signature is returned.

4. Soroban Execution:
   Relayer broadcasts transaction calling:
   MeridianRouter.execute_intent(intent, message_hash, relayer_address)
   Envelope gas is sponsored by MeridianPaymaster.
```
