# Developer Tutorial: Bridging USDC from Base into a Meridian Vault via CCTP V2

This tutorial walks through an end-to-end cross-chain deposit from **Base (CCTP Domain `6`)** into a **Meridian RWA Vault (`mvUSDC` or `maUSDC`)** on **Stellar Soroban (CCTP Domain `27`)** using `@meridian-protocol/sdk` and the Meridian Relayer.

---

## 1. Architecture Overview

When a user moves USDC from Base into a Meridian vault on Stellar, four steps occur:

1. **Quote (`MeridianSDK.getQuote`)**: Query live Circle Iris V2 fee tiers for `Base (domain 6) -> Stellar (domain 27)` and calculate the 10 bps (`0.10%`) Meridian relayer fee.
2. **Burn on Base (`TokenMessengerV2.depositForBurn`)**: Burn 6-decimal USDC on Base targeting Stellar domain `27`, with the Meridian Relayer's 32-byte Ed25519 public key as the `mintRecipient`.
3. **Circle Iris V2 Attestation (`pollCircleMessage`)**: Wait for Circle Iris to index the Base burn transaction and produce a cryptographic attestation, then verify the raw CCTP V2 message header and body (`readSourceDomain`, `readDestinationDomain`, `readAmount`, `readMintRecipient`).
4. **Fast Fill on Stellar (`MeridianRouter.execute_intent`)**: Build a `MeridianIntentParams` object (`MeridianSDK.buildIntent`), derive its deterministic replay-protection key (`computeOrderId`), and submit `execute_intent` on Stellar so the user receives `mvUSDC` (Open Vault) or `maUSDC` (KYC-gated Accredited Vault) shares immediately.

---

## 2. Prerequisites & Installation

Install the Meridian SDK and Stellar SDK in your TypeScript / Node.js project (`Node.js >= 20`):

```bash
npm install @meridian-protocol/sdk @stellar/stellar-sdk
```

Import the required helpers from `@meridian-protocol/sdk`:

```ts
import { createHash } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import {
  CCTP_DOMAINS,
  MeridianClient,
  MeridianSDK,
  NETWORKS,
  STELLAR_CCTP_DOMAIN,
  computeOrderId,
  encodeIntent,
  getDeployment,
  pollCircleMessage,
  readAmount,
  readDestinationDomain,
  readMintRecipient,
  readSourceDomain,
  toUnits,
} from '@meridian-protocol/sdk';
```

---

## 3. Step-by-Step Implementation

### Step 1: Resolve Deployed Stellar Contracts & Vault Target

Meridian provides two vaults on Stellar Testnet via `getDeployment('testnet')`:
- **Open Vault (`mvUSDC`)**: `CAYGFI63GSSZL2PRN4QZ37UAQ6ITAPARJ4WDAO27765GWP2QNDW3LF6L` (`requiresKyc: false`)
- **Accredited Vault (`maUSDC`)**: `CCTCBCSN2YT4UWGFI6XEL3P3TPZOKCXEWQAP4NCA4Q5B46ODE77DPPQH` (`requiresKyc: true`)

```ts
const deployment = getDeployment('testnet');
const openVault = deployment.vaults.find((v) => v.id === 'open')!;

console.log('Meridian Router:', deployment.contracts.router);
console.log('Target Open Vault (mvUSDC):', openVault.contractId);
```

### Step 2: Fetch a Live Cross-Chain Quote from Base to Stellar

Use `MeridianSDK.getQuote` to query Circle Iris V2 fee tiers for `sourceChain: 'base'` (`CCTP_DOMAINS.base === 6`) into `STELLAR_CCTP_DOMAIN === 27`:

```ts
const sdk = new MeridianSDK({ irisSandbox: true });

const quote = await sdk.getQuote({
  sourceChain: 'base',
  amountIn: '250', // 250 USDC
  finality: 'standard', // 2000 finality threshold (or 'fast' for 1000)
});

console.log('Origin Domain (Base):', quote.sourceDomain); // 6
console.log('Destination Domain (Stellar):', quote.destinationDomain); // 27
console.log('Circle CCTP Fee:', quote.cctpFee, 'USDC');
console.log('Meridian Relayer Fee (10 bps):', quote.relayerFee, 'USDC');
console.log('Estimated Net Vault Deposit:', quote.estimatedOutput, 'USDC');
```

### Step 3: Encode the Stellar `mintRecipient` & Burn USDC on Base

Circle CCTP V2 represents recipients as 32-byte words (`bytes32`). To convert the Meridian Relayer's Stellar `G...` address into a `bytes32` `mintRecipient` for Base's `TokenMessengerV2`:

```ts
const relayerStellarAddress = 'GD7GKYUEDFJVWFNVYPYOT7ENCYYF4Z7F6PUEMTI6HRRRYP325HVT7H5C';
const mintRecipientBytes32 =
  '0x' + Buffer.from(StrKey.decodeEd25519PublicKey(relayerStellarAddress)).toString('hex');

// On Base (EVM USDC has 6 decimals, so 250 USDC = 250_000_000n):
// tokenMessengerV2.depositForBurn(
//   250_000_000n,
//   STELLAR_CCTP_DOMAIN, // 27
//   mintRecipientBytes32,
//   BASE_USDC_ADDRESS,
//   '0x0000000000000000000000000000000000000000000000000000000000000000',
//   maxFee,
//   2000 // standard finalityThreshold
// );
```

### Step 4: Poll Circle Iris V2 & Verify the Base Burn Message

Once the Base burn transaction is submitted (`baseBurnTxHash`), poll Circle Iris V2 and validate the attested message layout before constructing or executing the Stellar intent:

```ts
const attested = await pollCircleMessage(CCTP_DOMAINS.base, baseBurnTxHash, {
  isSandbox: true,
  timeoutMs: 120_000,
});

// Verify CCTP V2 header & body invariants
if (readSourceDomain(attested.message) !== CCTP_DOMAINS.base) {
  throw new Error('Unexpected CCTP source domain');
}
if (readDestinationDomain(attested.message) !== STELLAR_CCTP_DOMAIN) {
  throw new Error('CCTP burn does not target Stellar (domain 27)');
}
if (readMintRecipient(attested.message).toLowerCase() !== mintRecipientBytes32.toLowerCase()) {
  throw new Error('CCTP mintRecipient does not match Meridian Relayer');
}

// Convert Base 6-decimal USDC units to Stellar 7-decimal stroops (* 10n)
const stellarAmountInUnits = (readAmount(attested.message) * 10n).toString();
const rawMessageBytes = Buffer.from(attested.message.replace(/^0x/, ''), 'hex');
const messageHashHex = createHash('sha256').update(rawMessageBytes).digest('hex');
```

### Step 5: Build the Meridian Vault Intent & Compute Order ID

Now construct the `CrossChainIntent` targeting the Open Vault (`mvUSDC`) using `sdk.buildIntent`:

```ts
const recipientStellarAddress = 'GD7GKYUEDFJVWFNVYPYOT7ENCYYF4Z7F6PUEMTI6HRRRYP325HVT7H5C';
const baseSenderEvmAddress = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

const intent = sdk.buildIntent({
  sourceChain: 'base',
  senderAddressHex: baseSenderEvmAddress,
  recipientStellarAddress,
  amountInUnits: stellarAmountInUnits, // e.g. toUnits('250').toString() === '2500000000'
  minOutUnits: toUnits('249.5').toString(), // 0.20% slippage/fee buffer in 7-decimal units
  path: [NETWORKS.testnet.usdc.contractId], // Direct USDC deposit (or multi-hop Soroswap path)
  vaultAddress: openVault.contractId,
  deadlineSecs: 3600, // Valid for 1 hour (router enforces <= 7 days)
});

// Deterministic replay-protection key: sha256(message_hash || xdr(intent))
const orderId = computeOrderId(intent, messageHashHex);
const intentScVal = encodeIntent(intent);

console.log('Deterministic Order ID:', orderId);
console.log('Encoded ScVal fields:', intentScVal.map()?.length);
```

### Step 6: Execute the Intent via Relayer & Verify Vault Shares

The Meridian Relayer (`SorobanExecutor.fill` in `services/relayer/src/soroban-executor.ts`) checks `client.isFilled(orderId)` and submits `MeridianRouter.execute_intent(intent, message_hash, relayer)`. After confirmation, query the recipient's vault share balance with `MeridianClient`:

```ts
const client = new MeridianClient('testnet');

const isOrderFilled = await client.isFilled(orderId);
const userShares = await client.getShares(openVault.contractId, recipientStellarAddress);

console.log('Order Filled:', isOrderFilled);
console.log('User mvUSDC Shares (7 decimals):', userShares.toString());
```

---

## 4. KYC-Gated Vaults (`maUSDC`)

If `vaultAddress` points to the Accredited Vault (`CCTCBCSN2YT4UWGFI6XEL3P3TPZOKCXEWQAP4NCA4Q5B46ODE77DPPQH`), `MeridianRouter::route_to_vault` automatically invokes `MeridianCompliance::is_eligible(recipient)` on-chain. Always pre-check eligibility before submitting an intent targeting a KYC-gated vault:

```ts
const eligible = await client.isEligible(recipientStellarAddress);
if (!eligible) {
  throw new Error('Recipient is not KYC-verified in MeridianCompliance for maUSDC');
}
```
