import type { MeridianNetwork } from './networks.js';

export type SourceChain = 'ethereum' | 'avalanche' | 'optimism' | 'arbitrum' | 'solana' | 'base' | 'polygon';

export interface CrossChainQuoteRequest {
  sourceChain: SourceChain;
  /** Human-readable USDC amount, e.g. "250" */
  amountIn: string;
  /** Circle finality threshold: fast (1000) or standard (2000) */
  finality?: 'fast' | 'standard';
}

export interface CrossChainQuoteResponse {
  sourceDomain: number;
  destinationDomain: number;
  finalityThreshold: number;
  /** Circle's minimum CCTP fee for this route, in basis points (from Iris) */
  cctpFeeBps: number;
  cctpFee: string;
  /** Fee the Meridian relayer charges to front liquidity on Stellar */
  relayerFeeBps: number;
  relayerFee: string;
  /** What arrives on Stellar, before any optional swap */
  estimatedOutput: string;
  steps: RouteStep[];
}

export interface RouteStep {
  name: string;
  chain: string;
  description: string;
}

/** Mirrors the Rust `CrossChainIntent` struct in contracts/router */
export interface MeridianIntentParams {
  originDomain: number;
  /** 32-byte hex (EVM addresses are left-padded) */
  senderBytes32: string;
  recipient: string;
  /** Integer USDC units (7 decimals) as a string */
  amountIn: string;
  minAmountOut: string;
  /** Unix seconds; the router rejects deadlines more than 7 days out */
  deadline: number;
  swapPath: string[];
  vaultTarget?: string;
  relayerFee: string;
}

export interface MeridianVaultDeployment {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  requiresKyc: boolean;
}

export interface MeridianDeployment {
  network: MeridianNetwork;
  deployedAt: string;
  admin: string;
  contracts: {
    router: string;
    compliance: string;
    paymaster: string;
  };
  vaults: MeridianVaultDeployment[];
  wasmHashes: Record<string, string>;
  txs: Record<string, string>;
}
