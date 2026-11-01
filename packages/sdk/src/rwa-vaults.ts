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
    targetAddress: 'CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS',
    baseAsset: 'USDC',
    apyEstimate: '8.40%',
    description: 'Decentralized liquidity pool generating yields backed by isolated overcollateralized loans on Soroban.',
  },
  {
    id: 'centrifuge-credit-tranche',
    name: 'Centrifuge Anemoy Liquid Treasury (deJAAA)',
    issuer: 'Centrifuge / Janus Henderson',
    assetType: 'PRIVATE_CREDIT',
    targetAddress: 'CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75',
    baseAsset: 'USDC',
    apyEstimate: '5.10%',
    description: 'Senior institutional credit tranche providing tokenized US short-term yields.',
  },
];
