# Meridian Protocol Architecture Specification

## 1. System Overview
Meridian Protocol is designed to bridge external blockchain liquidity directly into Stellar’s Soroban smart contract ecosystem, with a specialized focus on Real-World Assets (RWAs), money market yields, and cross-border fiat anchors.

---

## 2. Deployed Smart Contract Primitives (Stellar Soroban Testnet)

All protocol contracts are deployed, initialized, and verifiable on Stellar Soroban Testnet (`Test SDF Network ; September 2015`):

| Contract | Contract ID | Initialization Tx |
|---|---|---|
| `MeridianRouter` | [`CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED`](https://stellar.expert/explorer/testnet/contract/CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED) | [`ceff2fcb...77b98`](https://stellar.expert/explorer/testnet/tx/ceff2fcbb1c61eac260f1bcf7883255d06fd658f7e7ef31d965b2700f2277b98) |
| `MeridianPaymaster` | [`CCZIOZNGCPEB5KQSQW4DECO3AFTNXLTAOECAR3ZBS3QVIG4KSMUS2S6I`](https://stellar.expert/explorer/testnet/contract/CCZIOZNGCPEB5KQSQW4DECO3AFTNXLTAOECAR3ZBS3QVIG4KSMUS2S6I) | [`1b906928...f5424`](https://stellar.expert/explorer/testnet/tx/1b906928f8423400fa6f954c5edafbe022f2530074bda462a1b3122a83ef5424) |
| `MeridianCompliance` | [`CB65GHAERYSDNPGZYMEPESEKGC3PKL6UNOPYAZV6QUFW37OL7J24YU2S`](https://stellar.expert/explorer/testnet/contract/CB65GHAERYSDNPGZYMEPESEKGC3PKL6UNOPYAZV6QUFW37OL7J24YU2S) | [`9e0729de...ff031`](https://stellar.expert/explorer/testnet/tx/9e0729de3da687076c282acbdb04fe762e2cbb81f6d8fef27fb7ea8acbfff031) |
| `MeridianRwaVault` | [`CC4IZUGVELOW5Z7OBUSZWQSPBPM64IQYFA52YQZ7WGFVDMWRVO4OYAGK`](https://stellar.expert/explorer/testnet/contract/CC4IZUGVELOW5Z7OBUSZWQSPBPM64IQYFA52YQZ7WGFVDMWRVO4OYAGK) | [`65574d14...09d5`](https://stellar.expert/explorer/testnet/tx/65574d14cca2f612cc8ae74f0bdf94e9de128be7e948c1c429da955e0ef409d5) |

### 2.1 `MeridianRouter`
* **Address (Stellar Soroban Testnet)**: `CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED`
* **WASM Hash**: `5feb037a7dd5a85e75e804b16f0b358a19558943939f1483f501c38b945bad55`
* **Responsibilities**:
  * Acts as recipient for Circle CCTP inbound minting.
  * Verifies replay protection against `ProcessedMessage(BytesN<32>)`.
  * Deducts relayer/paymaster reimbursement fee within bounded `max_relayer_fee_bps`.
  * Dynamically invokes `SoroswapRouter` (`CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH` on Mainnet) for token swapping.
  * Dispatches tokens to target contracts implementing the Soroban Vault interface (`deposit(amount, recipient)`).

### 2.2 `MeridianPaymaster`
* **Address (Stellar Soroban Testnet)**: `CCZIOZNGCPEB5KQSQW4DECO3AFTNXLTAOECAR3ZBS3QVIG4KSMUS2S6I`
* **WASM Hash**: `7fdfeb22c0aa35c7c104579eb3cbecb48adcd2057e4edcf2608c65a0f0a64747`
* **Responsibilities**:
  * Solves the "Zero-XLM" cold-start dilemma for non-Stellar users.
  * Maintains an operational reserve of XLM to sponsor transaction envelope gas fees.
  * Reimburses itself via fractional USDC deductions (plus configurable basis-point markup) and tracks per-user sponsored volume.
  * Implements automated rebalancing (`rebalance_native`): sells collected USDC fees back into XLM via Soroswap AMM pools.

### 2.3 `MeridianCompliance`
* **Address (Stellar Soroban Testnet)**: `CB65GHAERYSDNPGZYMEPESEKGC3PKL6UNOPYAZV6QUFW37OL7J24YU2S`
* **WASM Hash**: `641c2aaeb25d764bdcb9a488628b0845f4a02dba4abef8263d3d975a3ce361ba`
* **Responsibilities**:
  * Enforces SEP-8 regulated asset compliance on Soroban.
  * Restricts access to permissioned institutional RWA vaults based on verifiable identity credentials and country whitelists.

### 2.4 `MeridianRwaVault`
* **Address (Stellar Soroban Testnet)**: `CC4IZUGVELOW5Z7OBUSZWQSPBPM64IQYFA52YQZ7WGFVDMWRVO4OYAGK`
* **WASM Hash**: `7b187c77142e232b4086d5ba1eb1391926902f9997d38211c1247c4df02fc2f6`
* **Underlying Asset**: `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (Testnet USDC SAC)
* **Authorized Router**: `CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED`
* **Responsibilities**:
  * Provides on-chain institutional European sovereign treasury bill vault (`mTBILL`) yield aggregation.
  * Implements the standard Soroban Vault interface (`deposit(amount, on_behalf_of)`), allowing `MeridianRouter` to automatically forward inbound cross-chain USDC and mint proportional shares for the destination account.
  * Supports direct individual deposits (`deposit_direct`) and investor share redemptions (`withdraw`).
  * Enforces emergency circuit breaker controls (`set_paused`).

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
