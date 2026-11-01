export interface GasEstimate {
  estimatedGasXlm: string;
  equivalentUsdcFee: string;
  paymasterSponsorshipAvailable: boolean;
  baseFeeStroops?: string;
  p90FeeStroops?: string;
}

export class MeridianPaymasterClient {
  private rpcUrl: string;

  constructor(rpcUrl = 'https://soroban-testnet.stellar.org') {
    this.rpcUrl = rpcUrl;
  }

  /**
   * Estimates envelope gas fees querying live Soroban RPC getFeeStats
   */
  public async estimateFee(operationType: 'swap' | 'vault_deposit'): Promise<GasEstimate> {
    try {
      const res = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getFeeStats' }),
      });
      const data = await res.json();
      const stats = data.result?.sorobanInclusionFee;
      const baseStroops = stats?.mode || '100';
      const p90Stroops = stats?.p90 || '100';

      // Minimum resource fee for Soroban Host invocation ~ 1,400 to 2,500 stroops
      const hostStroops = operationType === 'swap' ? 1800 : 2500;
      const totalStroops = parseInt(baseStroops) + hostStroops;
      const xlmCost = (totalStroops / 10_000_000).toFixed(7);

      return {
        estimatedGasXlm: xlmCost,
        equivalentUsdcFee: (parseFloat(xlmCost) * 0.12 * 1.15).toFixed(4), // USDC value with 15% markup
        paymasterSponsorshipAvailable: true,
        baseFeeStroops: baseStroops,
        p90FeeStroops: p90Stroops,
      };
    } catch {
      // Fallback standard calculation
      const xlmEstimate = operationType === 'swap' ? '0.0001900' : '0.0002600';
      return {
        estimatedGasXlm: xlmEstimate,
        equivalentUsdcFee: '0.0003',
        paymasterSponsorshipAvailable: true,
      };
    }
  }
}
