import { CCTP_DOMAINS, FINALITY_THRESHOLD, STELLAR_CCTP_DOMAIN, fetchIrisFees } from './cctp.js';
import { fromUnits, toUnits } from './networks.js';
import type { CrossChainQuoteRequest, CrossChainQuoteResponse, MeridianIntentParams, SourceChain } from './types.js';

/** Fee the Meridian relayer charges for fronting USDC on Stellar (0.10%). The router caps it on-chain. */
export const RELAYER_FEE_BPS = 10;

export class MeridianSDK {
  constructor(private readonly opts: { irisSandbox?: boolean } = {}) {}

  /**
   * Quote a CCTP route into Stellar. The CCTP fee comes live from Circle Iris;
   * the relayer fee is Meridian's published policy. No slippage is invented:
   * a USDC -> USDC route is 1:1 minus fees.
   */
  public async getQuote(request: CrossChainQuoteRequest): Promise<CrossChainQuoteResponse> {
    const sourceDomain = CCTP_DOMAINS[request.sourceChain];
    if (sourceDomain === undefined) {
      throw new Error(`Unsupported source chain: ${request.sourceChain}`);
    }
    const finalityThreshold = FINALITY_THRESHOLD[request.finality ?? 'standard'];
    const fees = await fetchIrisFees(sourceDomain, STELLAR_CCTP_DOMAIN, {
      isSandbox: this.opts.irisSandbox ?? true,
    });
    const tier = fees.find((f) => f.finalityThreshold === finalityThreshold);
    if (!tier) {
      throw new Error(`Circle Iris returned no ${request.finality ?? 'standard'} fee tier for this route`);
    }

    const amount = toUnits(request.amountIn);
    // Iris fees can be fractional bps (e.g. 1.3), so scale by 100 before integer math
    const cctpFee = (amount * BigInt(Math.round(tier.minimumFee * 100))) / 1_000_000n;
    const relayerFee = ((amount - cctpFee) * BigInt(RELAYER_FEE_BPS)) / 10_000n;

    return {
      sourceDomain,
      destinationDomain: STELLAR_CCTP_DOMAIN,
      finalityThreshold,
      cctpFeeBps: tier.minimumFee,
      cctpFee: fromUnits(cctpFee),
      relayerFeeBps: RELAYER_FEE_BPS,
      relayerFee: fromUnits(relayerFee),
      estimatedOutput: fromUnits(amount - cctpFee - relayerFee),
      steps: [
        {
          name: 'Burn on origin',
          chain: request.sourceChain,
          description: `Burn ${request.amountIn} USDC with CCTP V2 (destination domain ${STELLAR_CCTP_DOMAIN})`,
        },
        {
          name: 'Circle attestation',
          chain: 'Circle Iris',
          description: 'Relayer waits for the attested message and checks domain and amount',
        },
        {
          name: 'Fast fill on Stellar',
          chain: 'Stellar Soroban',
          description: 'Relayer fronts USDC through MeridianRouter.execute_intent to the recipient or a vault',
        },
      ],
    };
  }

  /** Build intent params for MeridianRouter.execute_intent */
  public buildIntent(params: {
    sourceChain: SourceChain;
    senderAddressHex: string;
    recipientStellarAddress: string;
    amountInUnits: string;
    minOutUnits: string;
    path: string[];
    vaultAddress?: string;
    deadlineSecs?: number;
  }): MeridianIntentParams {
    const originDomain = CCTP_DOMAINS[params.sourceChain];
    if (originDomain === undefined) {
      throw new Error(`Unsupported source chain: ${params.sourceChain}`);
    }
    return {
      originDomain,
      senderBytes32: params.senderAddressHex.replace(/^0x/, '').padStart(64, '0'),
      recipient: params.recipientStellarAddress,
      amountIn: params.amountInUnits,
      minAmountOut: params.minOutUnits,
      deadline: Math.floor(Date.now() / 1000) + (params.deadlineSecs ?? 3600),
      swapPath: params.path,
      vaultTarget: params.vaultAddress,
      relayerFee: ((BigInt(params.amountInUnits) * BigInt(RELAYER_FEE_BPS)) / 10_000n).toString(),
    };
  }
}
