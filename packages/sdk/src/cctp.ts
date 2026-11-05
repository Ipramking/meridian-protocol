import type { SourceChain } from './types.js';

/** Circle CCTP domain ids. Circle Iris recognizes Stellar as domain 27. */
export const CCTP_DOMAINS: Record<SourceChain | 'stellar', number> = {
  ethereum: 0,
  avalanche: 1,
  optimism: 2,
  arbitrum: 3,
  solana: 5,
  base: 6,
  polygon: 7,
  stellar: 27,
};

export const STELLAR_CCTP_DOMAIN = CCTP_DOMAINS.stellar;

export const CIRCLE_IRIS_API_MAINNET = 'https://iris-api.circle.com';
export const CIRCLE_IRIS_API_SANDBOX = 'https://iris-api-sandbox.circle.com';

/** Finality thresholds used by CCTP V2: 1000 = fast transfer, 2000 = standard */
export const FINALITY_THRESHOLD = { fast: 1000, standard: 2000 } as const;

export interface IrisFeeQuote {
  finalityThreshold: number;
  /** Minimum fee in basis points */
  minimumFee: number;
  forwardFee?: { low: number; med: number; high: number };
}

export interface IrisMessage {
  message: string;
  attestation: string | null;
  eventNonce: string;
  status: 'pending_confirmations' | 'complete';
}

function irisBase(isSandbox: boolean): string {
  return isSandbox ? CIRCLE_IRIS_API_SANDBOX : CIRCLE_IRIS_API_MAINNET;
}

/** Real-time CCTP V2 fee quotes from Circle Iris */
export async function fetchIrisFees(
  sourceDomain: number,
  destDomain: number,
  { isSandbox = true, forward = false } = {}
): Promise<IrisFeeQuote[]> {
  const url = `${irisBase(isSandbox)}/v2/burn/USDC/fees/${sourceDomain}/${destDomain}${forward ? '?forward=true' : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Iris fee quote failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as IrisFeeQuote[];
}

/** Messages Circle has indexed for a burn transaction on the source chain */
export async function fetchCircleV2Messages(
  sourceDomain: number,
  transactionHash: string,
  isSandbox = true
): Promise<IrisMessage[]> {
  const url = `${irisBase(isSandbox)}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;
  const res = await fetch(url);
  if (res.status === 404) {
    // Not indexed by Circle yet
    return [];
  }
  if (!res.ok) {
    throw new Error(`Iris message lookup error (${res.status}): ${await res.text()}`);
  }
  const body = (await res.json()) as { messages?: IrisMessage[] };
  return body.messages ?? [];
}

/** Poll Iris until the burn's message is attested, then return it */
export async function pollCircleMessage(
  sourceDomain: number,
  transactionHash: string,
  { timeoutMs = 120_000, intervalMs = 3_000, isSandbox = true } = {}
): Promise<IrisMessage & { attestation: string }> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const messages = await fetchCircleV2Messages(sourceDomain, transactionHash, isSandbox);
    const done = messages.find((m) => m.status === 'complete' && m.attestation);
    if (done) {
      return done as IrisMessage & { attestation: string };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`CCTP attestation timed out for ${transactionHash} on domain ${sourceDomain}`);
}

// CCTP V2 message layout (bytes):
//   header: version 0 | sourceDomain 4 | destinationDomain 8 | nonce 12 | sender 44 |
//           recipient 76 | destinationCaller 108 | minFinality 140 | finalityExecuted 144
//   body (from 148): version 148 | burnToken 152 | mintRecipient 184 | amount 216 |
//           messageSender 248 | maxFee 280 | feeExecuted 312 | expirationBlock 344 | hookData 376
const SOURCE_DOMAIN_OFFSET = 4;
const DESTINATION_DOMAIN_OFFSET = 8;
const NONCE_OFFSET = 12;
const MINT_RECIPIENT_OFFSET = 184;
const AMOUNT_OFFSET = 216;
const EXPIRATION_BLOCK_OFFSET = 344;

function clean(messageHex: string): string {
  return messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;
}

function readWord(messageHex: string, offsetBytes: number): string {
  const hex = clean(messageHex);
  const endChar = (offsetBytes + 32) * 2;
  if (hex.length < endChar) {
    throw new Error(`Malformed CCTP message: length ${hex.length} is less than required offset ${endChar}`);
  }
  return hex.slice(offsetBytes * 2, endChar);
}

function readUint32(messageHex: string, offsetBytes: number): number {
  const hex = clean(messageHex);
  return parseInt(hex.slice(offsetBytes * 2, offsetBytes * 2 + 8), 16);
}

export function readSourceDomain(messageHex: string): number {
  return readUint32(messageHex, SOURCE_DOMAIN_OFFSET);
}

export function readDestinationDomain(messageHex: string): number {
  return readUint32(messageHex, DESTINATION_DOMAIN_OFFSET);
}

export function readNonce(messageHex: string): string {
  return '0x' + readWord(messageHex, NONCE_OFFSET);
}

export function readMintRecipient(messageHex: string): string {
  return '0x' + readWord(messageHex, MINT_RECIPIENT_OFFSET);
}

/** Burned amount in the source token's units (USDC has 6 decimals on EVM chains) */
export function readAmount(messageHex: string): bigint {
  return BigInt('0x' + readWord(messageHex, AMOUNT_OFFSET));
}

export function readExpirationBlock(messageHex: string): bigint {
  return BigInt('0x' + readWord(messageHex, EXPIRATION_BLOCK_OFFSET));
}
