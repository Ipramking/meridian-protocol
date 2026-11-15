import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrKey, scValToNative } from '@stellar/stellar-sdk';
import {
  CCTP_DOMAINS,
  MeridianSDK,
  NETWORKS,
  RELAYER_FEE_BPS,
  STELLAR_CCTP_DOMAIN,
  computeOrderId,
  encodeIntent,
  getDeployment,
  readAmount,
  readDestinationDomain,
  readMintRecipient,
  readNonce,
  readSourceDomain,
  toUnits,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const tutorialPath = path.join(repoRoot, 'docs', 'TUTORIAL_CCTP_BASE_TO_MERIDIAN.md');

/** Build a synthetic 376-byte CCTP V2 burn message matching the layout in packages/sdk/src/cctp.ts */
function buildMockCctpV2Message({
  sourceDomain,
  destinationDomain,
  nonceHex32,
  mintRecipientHex32,
  amountUnits6Decimals,
}) {
  const buf = Buffer.alloc(376, 0);
  buf.writeUInt32BE(sourceDomain, 4);
  buf.writeUInt32BE(destinationDomain, 8);
  Buffer.from(nonceHex32.replace(/^0x/, ''), 'hex').copy(buf, 12);
  Buffer.from(mintRecipientHex32.replace(/^0x/, ''), 'hex').copy(buf, 184);

  const amountHex = BigInt(amountUnits6Decimals).toString(16).padStart(64, '0');
  Buffer.from(amountHex, 'hex').copy(buf, 216);
  return '0x' + buf.toString('hex');
}

test('Base-to-Meridian CCTP tutorial exists and documents Base domain 6 -> Stellar domain 27 flow', () => {
  assert.equal(fs.existsSync(tutorialPath), true, 'docs/TUTORIAL_CCTP_BASE_TO_MERIDIAN.md must exist');
  const doc = fs.readFileSync(tutorialPath, 'utf8');
  assert.ok(doc.includes("sourceChain: 'base'"));
  assert.ok(doc.includes('MeridianSDK'));
  assert.ok(doc.includes('computeOrderId'));
  assert.ok(doc.includes('pollCircleMessage'));
});

test('Base-to-Stellar CCTP V2 message parsing and Meridian vault intent construction work end-to-end', () => {
  const deployment = getDeployment('testnet');
  const openVault = deployment.vaults.find((v) => v.id === 'open');
  assert.ok(openVault);

  const relayerAddress = 'GD7GKYUEDFJVWFNVYPYOT7ENCYYF4Z7F6PUEMTI6HRRRYP325HVT7H5C';
  const mintRecipientBytes32 =
    '0x' + Buffer.from(StrKey.decodeEd25519PublicKey(relayerAddress)).toString('hex');
  const nonceBytes32 = '0x' + '11'.repeat(32);

  // 250 USDC on Base (6 decimals = 250_000_000)
  const messageHex = buildMockCctpV2Message({
    sourceDomain: CCTP_DOMAINS.base,
    destinationDomain: STELLAR_CCTP_DOMAIN,
    nonceHex32: nonceBytes32,
    mintRecipientHex32: mintRecipientBytes32,
    amountUnits6Decimals: 250_000_000n,
  });

  assert.equal(readSourceDomain(messageHex), 6);
  assert.equal(readDestinationDomain(messageHex), 27);
  assert.equal(readNonce(messageHex), nonceBytes32);
  assert.equal(readMintRecipient(messageHex), mintRecipientBytes32);
  assert.equal(readAmount(messageHex), 250_000_000n);

  // Scale 6-decimal EVM USDC to 7-decimal Stellar stroops
  const stellarAmountUnits = (readAmount(messageHex) * 10n).toString();
  assert.equal(stellarAmountUnits, toUnits('250').toString());

  const sdk = new MeridianSDK({ irisSandbox: true });
  const intent = sdk.buildIntent({
    sourceChain: 'base',
    senderAddressHex: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
    recipientStellarAddress: relayerAddress,
    amountInUnits: stellarAmountUnits,
    minOutUnits: toUnits('249.5').toString(),
    path: [NETWORKS.testnet.usdc.contractId],
    vaultAddress: openVault.contractId,
    deadlineSecs: 3600,
  });

  assert.equal(intent.originDomain, 6);
  assert.equal(intent.vaultTarget, openVault.contractId);
  assert.equal(
    BigInt(intent.relayerFee),
    (2_500_000_000n * BigInt(RELAYER_FEE_BPS)) / 10_000n
  );

  const rawBytes = Buffer.from(messageHex.slice(2), 'hex');
  const messageHashHex = createHash('sha256').update(rawBytes).digest('hex');
  const orderId = computeOrderId(intent, messageHashHex);
  assert.match(orderId, /^[0-9a-f]{64}$/);

  const scVal = encodeIntent(intent);
  const decoded = scValToNative(scVal);
  assert.equal(decoded.origin_domain, 6);
  assert.equal(decoded.amount_in, 2_500_000_000n);
  assert.equal(decoded.vault_target, openVault.contractId);
});
