import { CrossChainQuoteRequest, CrossChainQuoteResponse, MeridianIntentParams } from './types.js';
import { CCTP_DOMAINS, CCTP_TOKEN_MESSENGERS } from './cctp.js';

export const SOROSWAP_ROUTER_MAINNET = 'CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH';
export const MERIDIAN_ROUTER_CONTRACT = 'CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED';
export const MERIDIAN_PAYMASTER_CONTRACT = 'CCZIOZNGCPEB5KQSQW4DECO3AFTNXLTAOECAR3ZBS3QVIG4KSMUS2S6I';
export const MERIDIAN_COMPLIANCE_CONTRACT = 'CB65GHAERYSDNPGZYMEPESEKGC3PKL6UNOPYAZV6QUFW37OL7J24YU2S';

export class MeridianSDK {
  /**
   * Generates an optimal quote across CCTP and Soroswap AMM
   */
  public async getQuote(request: CrossChainQuoteRequest): Promise<CrossChainQuoteResponse> {
    const originDomain = CCTP_DOMAINS[request.sourceChain];
    if (originDomain === undefined) {
      throw new Error(`Unsupported source chain: ${request.sourceChain}`);
    }

    const amountInNum = parseFloat(request.amountIn);
    const relayerFee = (amountInNum * 0.0015).toFixed(4); // 0.15% fee
    const netInput = amountInNum - parseFloat(relayerFee);

    const estOut = (netInput * 0.998).toFixed(4); // 0.2% estimated slippage/price impact
    const minOut = (netInput * 0.99).toFixed(4); // 1.0% max slippage

    return {
      routeType: 'CCTP_DEX',
      estimatedOutput: estOut,
      minimumOutput: minOut,
      relayerFeeUsdc: relayerFee,
      estimatedTimeSeconds: 45,
      steps: [
        {
          name: 'Burn on Origin',
          chain: request.sourceChain,
          description: `Burn ${request.amountIn} USDC via Circle CCTP TokenMessenger`,
          contract:
            CCTP_TOKEN_MESSENGERS[request.sourceChain.toLowerCase()] ||
            CCTP_TOKEN_MESSENGERS.ethereum,
        },
        {
          name: 'Circle Attestation',
          chain: 'Circle Iris Network',
          description: 'Cryptographic attestation confirmation (20-40 seconds)',
          contract: 'Circle Iris Attestation Service',
        },
        {
          name: 'Atomic Swap & Vault Allocation',
          chain: 'Stellar Soroban',
          description: `Mint to MeridianRouter, swap to ${request.targetAsset}, and allocate to destination`,
          contract: MERIDIAN_ROUTER_CONTRACT,
        },
      ],
    };
  }

  /**
   * Build intent payload ready for Soroban execution
   */
  public buildIntent(params: {
    sourceChain: string;
    senderAddressHex: string;
    recipientStellarAddress: string;
    amountInUnits: string;
    minOutUnits: string;
    path: string[];
    vaultAddress?: string;
  }): MeridianIntentParams {
    const originDomain = CCTP_DOMAINS[params.sourceChain] ?? 0;
    return {
      originDomain,
      senderBytes32: params.senderAddressHex.padStart(64, '0'),
      recipient: params.recipientStellarAddress,
      amountIn: params.amountInUnits,
      minAmountOut: params.minOutUnits,
      deadline: Math.floor(Date.now() / 1000) + 3600,
      swapPath: params.path,
      vaultTarget: params.vaultAddress,
      relayerFee: (BigInt(params.amountInUnits) / 1000n).toString(),
    };
  }
}
