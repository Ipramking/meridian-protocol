export type ChainDomain = 0 | 1 | 2 | 3 | 6 | 7 | 27; // 27 = Stellar

export interface CrossChainQuoteRequest {
  sourceChain: 'ethereum' | 'arbitrum' | 'optimism' | 'base' | 'solana';
  sourceToken: string;
  amountIn: string;
  destinationAccount: string;
  targetAsset: string;
  targetVault?: string;
  slippageToleranceBps?: number;
}

export interface CrossChainQuoteResponse {
  routeType: 'CCTP_DEX' | 'ALLBRIDGE_DEX' | 'DIRECT_CCTP';
  estimatedOutput: string;
  minimumOutput: string;
  relayerFeeUsdc: string;
  estimatedTimeSeconds: number;
  steps: RouteStep[];
}

export interface RouteStep {
  name: string;
  chain: string;
  description: string;
  contract: string;
}

export interface MeridianIntentParams {
  originDomain: number;
  senderBytes32: string;
  recipient: string;
  amountIn: string;
  minAmountOut: string;
  deadline: number;
  swapPath: string[];
  vaultTarget?: string;
  relayerFee: string;
}
