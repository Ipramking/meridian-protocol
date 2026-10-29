export interface GasEstimate {
  estimatedGasXlm: string;
  equivalentUsdcFee: string;
  paymasterSponsorshipAvailable: boolean;
}

export class MeridianPaymasterClient {
  public async estimateFee(operationType: 'swap' | 'vault_deposit'): Promise<GasEstimate> {
    // Stellar transactions consume fractions of a cent in XLM
    const xlmEstimate = operationType === 'swap' ? '0.005' : '0.008';
    const usdcFee = '0.05'; // $0.05 flat sponsored convenience fee

    return {
      estimatedGasXlm: xlmEstimate,
      equivalentUsdcFee: usdcFee,
      paymasterSponsorshipAvailable: true,
    };
  }
}
