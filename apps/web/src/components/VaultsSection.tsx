'use client';

import React, { useEffect, useState } from 'react';
import { explorerContractUrl, fromUnits, toUnits, type VaultView } from '@meridian-protocol/sdk';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, ExtLink, Input, Loading, NoteBox, Section, Stat } from './ui';
import { TxReview } from './TxReview';
import { useWallet } from './WalletProvider';
import { useSorobanTx } from '@/lib/useSorobanTx';
import { NETWORK, errorMessage, fmtUnits, getClient, shortAddr } from '@/lib/meridian';

function explainError(message: string) {
  if (message.includes('NotEligible')) {
    return (
      <p className="mt-1 text-red-200/80">
        This vault is KYC-gated: the router checks MeridianCompliance before depositing. On testnet, verification is
        granted by the compliance admin; there is no self-serve KYC.
      </p>
    );
  }
  if (message.includes('InsufficientBalance') || message.includes('TrustlineMissing')) {
    return <p className="mt-1 text-red-200/80">The account needs enough USDC (see Step 1) to cover this amount.</p>;
  }
  return null;
}

function parseAmount(value: string): bigint | null {
  try {
    const units = toUnits(value);
    return units > 0n ? units : null;
  } catch {
    return null;
  }
}

function VaultCard({ vault }: { vault: VaultView }) {
  const { address, status } = useWallet();
  const deposit = useSorobanTx();
  const withdraw = useSorobanTx();
  const [depositAmount, setDepositAmount] = useState('10');
  const [withdrawShares, setWithdrawShares] = useState('');
  const client = getClient();
  const connected = status === 'connected' && !!address;
  const depositUnits = parseAmount(depositAmount);
  const withdrawUnits = parseAmount(withdrawShares);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-white">{vault.name}</h3>
          <div className="mt-0.5 font-mono text-xs text-slate-400">{vault.symbol}</div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {vault.requiresKyc ? <Badge tone="amber">KYC-gated</Badge> : <Badge tone="green">Open</Badge>}
          {!vault.enabled && <Badge tone="amber">Not allowlisted</Badge>}
          {vault.paused && <Badge tone="amber">Deposits paused</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Stat label="Total assets" value={`${fmtUnits(vault.totalAssets)} USDC`} />
        <Stat label="Total shares" value={fmtUnits(vault.totalShares)} />
        <Stat label="Share price" value={`${vault.sharePrice.toFixed(4)} USDC`} />
        <Stat
          label="Contract"
          value={<ExtLink href={explorerContractUrl(NETWORK, vault.contractId)}>{shortAddr(vault.contractId, 6, 4)}</ExtLink>}
        />
      </div>

      {vault.account && (
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-stellar-border/70 bg-stellar-dark/50 p-3">
          <Stat label="Your shares" value={fmtUnits(vault.account.shares)} />
          <Stat label="Your value" value={`${fmtUnits(vault.account.value)} USDC`} />
          {vault.requiresKyc && (
            <Stat
              label="Eligibility"
              mono={false}
              value={vault.account.eligible ? <Badge tone="green">Verified</Badge> : <Badge tone="amber">Not verified</Badge>}
            />
          )}
        </div>
      )}

      {connected ? (
        <div className="space-y-4 border-t border-stellar-border/60 pt-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-300">Deposit USDC via MeridianRouter</div>
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={depositAmount}
                onChange={(e) => {
                  setDepositAmount(e.target.value);
                  deposit.reset();
                }}
                aria-label="USDC to deposit"
              />
              <Button
                disabled={!depositUnits || deposit.state.phase !== 'idle'}
                onClick={() => depositUnits && deposit.prepare(() => client.prepareDeposit(address, depositUnits, vault.contractId))}
              >
                Review
              </Button>
            </div>
            <TxReview
              state={deposit.state}
              onConfirm={deposit.confirm}
              onCancel={deposit.reset}
              explainError={explainError}
              describeResult={(v) => `Minted ${fmtUnits(BigInt(v as bigint))} ${vault.symbol} shares.`}
            />
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-slate-300">Withdraw (shares)</div>
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={withdrawShares}
                placeholder="0.0"
                onChange={(e) => {
                  setWithdrawShares(e.target.value);
                  withdraw.reset();
                }}
                aria-label="Shares to redeem"
              />
              <Button
                variant="secondary"
                disabled={!vault.account?.shares}
                onClick={() => {
                  setWithdrawShares(fromUnits(vault.account?.shares ?? 0n));
                  withdraw.reset();
                }}
              >
                Max
              </Button>
              <Button
                disabled={!withdrawUnits || withdraw.state.phase !== 'idle'}
                onClick={() => withdrawUnits && withdraw.prepare(() => client.prepareWithdraw(address, vault.contractId, withdrawUnits))}
              >
                Review
              </Button>
            </div>
            <TxReview
              state={withdraw.state}
              onConfirm={withdraw.confirm}
              onCancel={withdraw.reset}
              explainError={explainError}
              describeResult={(v) => `Received ${fmtUnits(BigInt(v as bigint))} USDC.`}
            />
          </div>
        </div>
      ) : (
        <p className="border-t border-stellar-border/60 pt-4 text-xs text-slate-400">Connect Freighter to deposit or withdraw.</p>
      )}
    </Card>
  );
}

export function VaultsSection() {
  const { address, refreshKey } = useWallet();
  const [vaults, setVaults] = useState<VaultView[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    getClient()
      .getVaults(address)
      .then((v) => !cancelled && setVaults(v))
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey, reload]);

  return (
    <Section
      id="vaults"
      eyebrow="Step 2"
      title="USDC vaults"
      description="Live state read from the vault contracts on every load. Deposits go through MeridianRouter, which only routes into allowlisted vaults and checks on-chain compliance for gated ones. Share price stays at 1.0000 until the manager distributes realized yield; no APY is promised."
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        {loading ? <Loading label="Reading vault state from testnet…" /> : <span className="text-xs text-slate-500">Read from Soroban RPC</span>}
        <Button variant="secondary" onClick={() => setReload((r) => r + 1)} className="px-3" aria-label="Reload vaults">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      {error && <ErrorBox>Could not read vault state: {error}</ErrorBox>}
      {vaults && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {vaults.map((v) => (
            <VaultCard key={v.contractId} vault={v} />
          ))}
        </div>
      )}
      <div className="mt-4">
        <NoteBox>
          Withdrawals stay open even if deposits are paused. Vault deposits are only accepted from MeridianRouter, so funds
          can&apos;t be pulled through the vault by anyone else.
        </NoteBox>
      </div>
    </Section>
  );
}
