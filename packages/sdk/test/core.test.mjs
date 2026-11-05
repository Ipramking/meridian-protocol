import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, scValToNative, xdr } from '@stellar/stellar-sdk';
import {
  MeridianClient,
  MeridianSDK,
  computeOrderId,
  encodeIntent,
  fromUnits,
  getDeployment,
  readAmount,
  readDestinationDomain,
  readExpirationBlock,
  readMintRecipient,
  readNonce,
  readSourceDomain,
  toUnits,
} from '../dist/index.js';

const recipient = Keypair.random().publicKey();
const usdc = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const vault = getDeployment('testnet').vaults[0].contractId;

function sampleIntent(overrides = {}) {
  return {
    originDomain: 3,
    senderBytes32: 'ab'.repeat(20),
    recipient,
    amountIn: '50000000',
    minAmountOut: '49950000',
    deadline: 1_900_000_000,
    swapPath: [usdc],
    vaultTarget: vault,
    relayerFee: '50000',
    ...overrides,
  };
}

test('toUnits / fromUnits round-trip with 7 decimals', () => {
  assert.equal(toUnits('12.5'), 125_000_000n);
  assert.equal(toUnits('0.0000001'), 1n);
  assert.equal(toUnits('7'), 70_000_000n);
  assert.equal(fromUnits(125_000_000n), '12.5');
  assert.equal(fromUnits(1n), '0.0000001');
  assert.equal(fromUnits(-50_000_000n), '-5');
  assert.throws(() => toUnits('1.12345678'), /decimal places/);
  assert.throws(() => toUnits('abc'), /Invalid amount/);
});

test('encodeIntent matches the Rust struct layout', () => {
  const encoded = encodeIntent(sampleIntent());
  assert.equal(encoded.type, 'scvMap');
  const keys = encoded.map.map((e) => String(e.key.value));
  assert.deepEqual(keys, [...keys].sort(), 'contracttype structs encode with sorted keys');
  assert.equal(keys.length, 9);

  const entry = (sv, key) => sv.map.find((e) => String(e.key.value) === key).val;
  assert.equal(entry(encoded, 'vault_target').type, 'scvAddress', 'Some(vault) is the bare address, not a vec');
  assert.equal(entry(encodeIntent(sampleIntent({ vaultTarget: undefined })), 'vault_target').type, 'scvVoid');

  const native = scValToNative(encoded);
  assert.equal(native.vault_target, vault);
  assert.equal(native.sender.length, 32, 'EVM senders are left-padded to 32 bytes');
  assert.equal(native.amount_in, 50_000_000n);
});

test('computeOrderId is deterministic and bound to the whole intent', () => {
  const msg = '11'.repeat(32);
  const a = computeOrderId(sampleIntent(), msg);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.equal(a, computeOrderId(sampleIntent(), msg));
  assert.notEqual(a, computeOrderId(sampleIntent({ amountIn: '50000001' }), msg));
  assert.notEqual(a, computeOrderId(sampleIntent(), '22'.repeat(32)));
});

test('CCTP V2 message fields are parsed from their offsets', () => {
  const buf = Buffer.alloc(376);
  buf.writeUInt32BE(1, 0);
  buf.writeUInt32BE(3, 4); // source: Arbitrum
  buf.writeUInt32BE(27, 8); // destination: Stellar
  buf.fill(0xaa, 12, 44); // nonce
  buf.fill(0xcd, 184, 216); // mintRecipient
  buf.writeBigUInt64BE(25_000_000n, 216 + 24); // amount: 25 USDC (6 decimals)
  buf.writeBigUInt64BE(12_345_678n, 344 + 24); // expiration block
  const hex = '0x' + buf.toString('hex');

  assert.equal(readSourceDomain(hex), 3);
  assert.equal(readDestinationDomain(hex), 27);
  assert.equal(readNonce(hex), '0x' + 'aa'.repeat(32));
  assert.equal(readMintRecipient(hex), '0x' + 'cd'.repeat(32));
  assert.equal(readAmount(hex), 25_000_000n);
  assert.equal(readExpirationBlock(hex), 12_345_678n);
  assert.throws(() => readAmount('0x' + '00'.repeat(100)), /Malformed CCTP message/);
});

test('describeError names the contract error at the origin of a host error', () => {
  const client = new MeridianClient('testnet');
  const { router } = client.deployment.contracts;
  const raw = (contract, code) =>
    `HostError: Error(Contract, #${code})\n\nEvent log (newest first):\n` +
    `   0: [Diagnostic Event] contract:${router}, topics:[error, Error(Contract, #${code})], data:"escalating"\n` +
    `   1: [Diagnostic Event] contract:${contract}, topics:[error, Error(Contract, #${code})], data:"origin"`;

  assert.match(client.describeError(raw(router, 15)), /^NotEligible \(router error #15\)/);
  assert.match(client.describeError(raw(vault, 6)), /^Paused \(vault error #6\)/);
  assert.match(client.describeError(raw(usdc, 10)), /^InsufficientBalance \(USDC error #10\)/);
});

test('getQuote uses the live Iris fee tier and invents no slippage', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(String(url), /\/v2\/burn\/USDC\/fees\/3\/27$/);
    return new Response(JSON.stringify([
      { finalityThreshold: 1000, minimumFee: 1.3 },
      { finalityThreshold: 2000, minimumFee: 0 },
    ]));
  });

  const sdk = new MeridianSDK();
  const standard = await sdk.getQuote({ sourceChain: 'arbitrum', amountIn: '1000', finality: 'standard' });
  assert.equal(standard.cctpFee, '0');
  assert.equal(standard.relayerFee, '1');
  assert.equal(standard.estimatedOutput, '999');

  const fast = await sdk.getQuote({ sourceChain: 'arbitrum', amountIn: '1000', finality: 'fast' });
  assert.equal(fast.cctpFeeBps, 1.3);
  assert.equal(fast.cctpFee, '0.13');
  // relayer fee is 0.10% of what remains after the CCTP fee: 999.87 * 0.001
  assert.equal(fast.relayerFee, '0.99987');
  assert.equal(fast.estimatedOutput, '998.87013');
});

test('getQuote fails loudly when Iris is unavailable', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('down', { status: 503 }));
  await assert.rejects(new MeridianSDK().getQuote({ sourceChain: 'base', amountIn: '10' }), /Iris fee quote failed \(503\)/);
});

test('buildIntent keeps the relayer fee within policy', () => {
  const intent = new MeridianSDK().buildIntent({
    sourceChain: 'base',
    senderAddressHex: '0x' + '12'.repeat(20),
    recipientStellarAddress: recipient,
    amountInUnits: '100000000',
    minOutUnits: '0',
    path: [usdc],
  });
  assert.equal(intent.originDomain, 6);
  assert.equal(intent.relayerFee, '100000'); // 0.10%
  assert.equal(intent.senderBytes32.length, 64);
  assert.ok(intent.deadline > Date.now() / 1000);
  assert.ok(xdr.ScVal.fromXDR(encodeIntent(intent).toXDR()));
});
