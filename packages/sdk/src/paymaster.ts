import { rpc } from '@stellar/stellar-sdk';

export interface SorobanFeeStats {
  /** Most common Soroban inclusion fee (stroops) over the RPC's recent window */
  inclusionFeeMode: string;
  inclusionFeeP90: string;
  latestLedger: number;
}

/** Live Soroban inclusion-fee stats from RPC `getFeeStats` */
export async function getSorobanFeeStats(rpcUrl: string): Promise<SorobanFeeStats> {
  const stats = await new rpc.Server(rpcUrl).getFeeStats();
  return {
    inclusionFeeMode: stats.sorobanInclusionFee.mode,
    inclusionFeeP90: stats.sorobanInclusionFee.p90,
    latestLedger: stats.latestLedger,
  };
}
