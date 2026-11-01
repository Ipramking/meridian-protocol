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

export const MERIDIAN_RWA_VAULT_CONTRACT = 'CC4IZUGVELOW5Z7OBUSZWQSPBPM64IQYFA52YQZ7WGFVDMWRVO4OYAGK';

export const SUPPORTED_STELLAR_VAULTS: SupportedRwaVault[] = [
  {
    id: 'meridian-tbill-vault',
    name: 'Spiko Liquid Treasury Vault (mTBILL)',
    issuer: 'Meridian / Spiko CACEIS Custody',
    assetType: 'TREASURY',
    targetAddress: MERIDIAN_RWA_VAULT_CONTRACT,
    baseAsset: 'USDC',
    apyEstimate: '4.25%',
    description: 'On-chain institutional European sovereign treasury bill vault with atomic CCTP routing on Stellar Soroban.',
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
