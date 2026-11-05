import { Buffer } from 'buffer';
import { Address, hash, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import type { MeridianIntentParams } from './types.js';

export function hexToBuffer(hex: string, length: number): Buffer {
  const clean = hex.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]*$/.test(clean) || clean.length > length * 2) {
    throw new Error(`Expected at most ${length} bytes of hex, got "${hex}"`);
  }
  return Buffer.from(clean.padStart(length * 2, '0'), 'hex');
}

function entry(key: string, val: xdr.ScVal): xdr.ScMapEntry {
  return new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val });
}

/**
 * Encode an intent exactly like the Rust `CrossChainIntent` #[contracttype]:
 * an ScMap with keys in sorted order. `Option<Address>` is Void for None and the
 * bare address for Some.
 */
export function encodeIntent(intent: MeridianIntentParams): xdr.ScVal {
  return xdr.ScVal.scvMap([
    entry('amount_in', nativeToScVal(BigInt(intent.amountIn), { type: 'i128' })),
    entry('deadline', nativeToScVal(BigInt(intent.deadline), { type: 'u64' })),
    entry('min_amount_out', nativeToScVal(BigInt(intent.minAmountOut), { type: 'i128' })),
    entry('origin_domain', nativeToScVal(intent.originDomain, { type: 'u32' })),
    entry('recipient', new Address(intent.recipient).toScVal()),
    entry('relayer_fee', nativeToScVal(BigInt(intent.relayerFee), { type: 'i128' })),
    entry('sender', xdr.ScVal.scvBytes(hexToBuffer(intent.senderBytes32, 32))),
    entry('swap_path', xdr.ScVal.scvVec(intent.swapPath.map((a) => new Address(a).toScVal()))),
    entry(
      'vault_target',
      intent.vaultTarget ? new Address(intent.vaultTarget).toScVal() : xdr.ScVal.scvVoid()
    ),
  ]);
}

/** Same derivation as `MeridianRouter::order_id`: sha256(message_hash || xdr(intent)) */
export function computeOrderId(intent: MeridianIntentParams, messageHashHex: string): string {
  const data = Buffer.concat([hexToBuffer(messageHashHex, 32), encodeIntent(intent).toXDR()]);
  return Buffer.from(hash(data)).toString('hex');
}
