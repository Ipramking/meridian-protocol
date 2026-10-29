export interface SupportedRwaVault {
  id: string;
  name: string;
  issuer: string;
  assetType: 'TREASURY' | 'PRIVATE_CREDIT' | 'MONEY_MARKET' | 'COMMODITY';
  targetAddress: string;
  baseAsset: string;
  apyEstimate: string;
  description: string;
}

export const SUPPORTED_STELLAR_VAULTS: SupportedRwaVault[] = [
  {
    id: 'spiko-eutbl',
    name: 'Spiko Euro T-Bills (eurSAFO)',
    issuer: 'Spiko / CACEIS Custody',
    assetType: 'TREASURY',
    targetAddress: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    baseAsset: 'USDC',
    apyEstimate: '3.65%',
    description: 'Direct institutional exposure to European Sovereign Treasury Bills tokenized on Stellar.',
  },
  {
    id: 'blend-usdc-market',
    name: 'Blend USDC Prime Pool',
    issuer: 'Blend Protocol',
    assetType: 'MONEY_MARKET',
    targetAddress: 'CAZ7Z5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL',
    baseAsset: 'USDC',
    apyEstimate: '8.40%',
    description: 'Decentralized liquidity pool generating yields backed by isolated overcollateralized loans on Soroban.',
  },
  {
    id: 'centrifuge-credit-tranche',
    name: 'Centrifuge Anemoy Liquid Treasury (deJAAA)',
    issuer: 'Centrifuge / Janus Henderson',
    assetType: 'PRIVATE_CREDIT',
    targetAddress: 'CCEN7Z5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL',
    baseAsset: 'USDC',
    apyEstimate: '5.10%',
    description: 'Senior institutional credit tranche providing tokenized US short-term yields.',
  },
];
