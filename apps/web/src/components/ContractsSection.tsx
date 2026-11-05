import React from 'react';
import { explorerAccountUrl, explorerContractUrl, explorerTxUrl, getDeployment } from '@meridian-protocol/sdk';
import { Card, ExtLink, Section } from './ui';
import { NETWORK, shortAddr } from '@/lib/meridian';

const deployment = getDeployment('testnet');

const CONTRACTS = [
  {
    name: 'MeridianRouter',
    role: 'Routes USDC into allowlisted vaults, runs relayer fast-fills with replay protection, optional Soroswap leg.',
    id: deployment.contracts.router,
    initTx: deployment.txs.routerInit,
  },
  {
    name: 'MeridianCompliance',
    role: 'On-chain eligibility registry the router checks before depositing into KYC-gated vaults.',
    id: deployment.contracts.compliance,
    initTx: deployment.txs.complianceInit,
  },
  ...deployment.vaults.map((v) => ({
    name: `MeridianRwaVault · ${v.symbol}`,
    role: `${v.name}. USDC share vault; deposits only via the router${v.requiresKyc ? ', compliance-gated' : ''}.`,
    id: v.contractId,
    initTx: deployment.txs[`${v.id}VaultInit`],
  })),
  {
    name: 'MeridianPaymaster',
    role: 'Fee-accounting contract (USDC fee records, rebalancing to XLM via Soroswap). Deployed, not used by the app flows yet.',
    id: deployment.contracts.paymaster,
    initTx: deployment.txs.paymasterInit,
  },
];

export function ContractsSection() {
  return (
    <Section
      id="contracts"
      eyebrow="Deployments"
      title="Contracts on Stellar testnet"
      description={
        <>
          Deployed {new Date(deployment.deployedAt).toUTCString()} by admin{' '}
          <ExtLink href={explorerAccountUrl(NETWORK, deployment.admin)} className="font-mono">
            {shortAddr(deployment.admin, 6, 6)}
          </ExtLink>
          . Not yet deployed to mainnet.
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CONTRACTS.map((c) => (
          <Card key={c.id}>
            <div className="text-sm font-bold text-white">{c.name}</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.role}</p>
            <div className="mt-3 break-all rounded-lg border border-slate-800 bg-slate-900/70 p-2.5 font-mono text-xs text-slate-200">
              {c.id}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <ExtLink href={explorerContractUrl(NETWORK, c.id)}>Stellar Expert</ExtLink>
              {c.initTx && <ExtLink href={explorerTxUrl(NETWORK, c.initTx)}>Init transaction</ExtLink>}
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
