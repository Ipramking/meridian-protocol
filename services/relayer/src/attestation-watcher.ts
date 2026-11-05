import { createHash } from 'crypto';
import {
  CCTP_DOMAINS,
  STELLAR_CCTP_DOMAIN,
  pollCircleMessage,
  readAmount,
  readDestinationDomain,
  readMintRecipient,
  readSourceDomain,
  type SourceChain,
} from '@meridian-protocol/sdk';

export interface VerifiedBurn {
  sourceChain: SourceChain;
  sourceDomain: number;
  txHash: string;
  message: string;
  attestation: string;
  /** sha256 of the raw CCTP message; used as the router's replay key */
  messageHash: string;
  /** Burned USDC converted from 6 (EVM) to 7 (Stellar) decimals */
  amountUnits: bigint;
  mintRecipient: string;
  /** messageSender word from the burn message body (the burner on the source chain) */
  sender: string;
}

// CCTP V2 burn message body: messageSender is the 32-byte word at byte 248
const MESSAGE_SENDER_OFFSET = 248;

/**
 * Waits for Circle to attest a CCTP burn and checks the attested message before
 * the relayer risks its own liquidity on a fill.
 */
export class AttestationWatcher {
  constructor(private readonly isSandbox = true) {}

  async verifyBurn(sourceChain: SourceChain, txHash: string, timeoutMs = 20 * 60_000): Promise<VerifiedBurn> {
    const sourceDomain = CCTP_DOMAINS[sourceChain];
    if (sourceDomain === undefined) {
      throw new Error(`Unsupported source chain: ${sourceChain}`);
    }

    console.log(`[watcher] waiting for Circle attestation of ${txHash} (domain ${sourceDomain})`);
    const msg = await pollCircleMessage(sourceDomain, txHash, { timeoutMs, isSandbox: this.isSandbox });

    if (readSourceDomain(msg.message) !== sourceDomain) {
      throw new Error(`Attested message is from domain ${readSourceDomain(msg.message)}, expected ${sourceDomain}`);
    }
    const destination = readDestinationDomain(msg.message);
    if (destination !== STELLAR_CCTP_DOMAIN) {
      throw new Error(`Burn targets CCTP domain ${destination}, not Stellar (${STELLAR_CCTP_DOMAIN})`);
    }

    const raw = Buffer.from(msg.message.replace(/^0x/, ''), 'hex');
    return {
      sourceChain,
      sourceDomain,
      txHash,
      message: msg.message,
      attestation: msg.attestation,
      messageHash: createHash('sha256').update(raw).digest('hex'),
      amountUnits: readAmount(msg.message) * 10n,
      mintRecipient: readMintRecipient(msg.message),
      sender: '0x' + raw.subarray(MESSAGE_SENDER_OFFSET, MESSAGE_SENDER_OFFSET + 32).toString('hex'),
    };
  }
}
