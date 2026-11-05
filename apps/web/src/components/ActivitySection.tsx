'use client';

import React, { useEffect, useState } from 'react';
import {
  RECEIPTS,
  explorerAccountUrl,
  explorerTxUrl,
  getDeployment,
  type ActivityEvent,
} from '@meridian-protocol/sdk';
import { RefreshCw } from 'lucide-react';
import { Badge, Button, Card, ErrorBox, ExtLink, Loading, NoteBox, Section } from './ui';
import { useWallet } from './WalletProvider';
import { NETWORK, errorMessage, fmtUnits, getClient, shortAddr, timeAgo } from '@/lib/meridian';

const deployment = getDeployment('testnet');
const vaultName = (id?: string) => deployment.vaults.find((v) => v.contractId === id)?.symbol ?? (id ? shortAddr(id) : '');

function EventRow({ e }: { e: ActivityEvent }) {
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-stellar-border/60 bg-stellar-dark/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        {e.type === 'fill' ? <Badge tone="blue">Fill</Badge> : <Badge tone="green">Deposit</Badge>}
        <span className="font-mono text-slate-200">{fmtUnits(e.amountIn)} USDC</span>
        {e.type === 'fill' ? (
          <span className="text-slate-400">
            from domain {e.originDomain} → {fmtUnits(e.amountOut)} delivered to {shortAddr(e.account)}
          </span>
        ) : (
          <span className="text-slate-400">
            by {shortAddr(e.account)} → {fmtUnits(e.amountOut)} {vaultName(e.vault)} shares
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500">
        <span>
          ledger {e.ledger.toLocaleString('en-US')} · {timeAgo(e.closedAt)}
        </span>
        <ExtLink href={explorerTxUrl(NETWORK, e.txHash)}>tx</ExtLink>
      </div>
    </li>
  );
}

export function ActivitySection() {
  const { refreshKey } = useWallet();
  const [events, setEvents] = useState<ActivityEvent[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const run = RECEIPTS[0];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    getClient()
      .getActivity(20)
      .then((ev) => !cancelled && setEvents(ev))
      .catch((err) => !cancelled && setError(errorMessage(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey, reload]);

  return (
    <Section
      id="activity"
      eyebrow="On-chain"
      title="Router activity"
      description="Fill and deposit events emitted by MeridianRouter, read from Soroban RPC. The public RPC keeps roughly the last 7 days of events. Fills so far are test intents from the e2e script: the origin domain is part of the intent, and no real origin-chain burn has been relayed yet."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-white">Recent events</span>
            <Button variant="secondary" onClick={() => setReload((r) => r + 1)} className="px-3" aria-label="Reload activity">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {loading && <Loading label="Scanning router events…" />}
          {error && <ErrorBox>Could not read events: {error}</ErrorBox>}
          {!loading && events && events.length === 0 && (
            <p className="text-sm text-slate-400">No router events in the RPC&apos;s retention window yet.</p>
          )}
          {!loading && events && events.length > 0 && (
            <ul className="space-y-2">
              {events.map((e) => (
                <EventRow key={`${e.txHash}-${e.type}`} e={e} />
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="text-sm font-semibold text-white">Verified test run</div>
          {run ? (
            <>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Scripted end-to-end run (<span className="font-mono">scripts/e2e-testnet.mjs</span>) on {new Date(run.ranAt).toUTCString()} with
                fresh accounts and USDC bought on the DEX. Every step asserts on-chain state; the relayer fill is a test
                intent with no origin-chain burn behind it.
              </p>
              <div className="mt-2 text-xs">
                Test account <ExtLink href={explorerAccountUrl(NETWORK, run.account)} className="font-mono">{shortAddr(run.account, 6, 6)}</ExtLink>
              </div>
              <ol className="mt-3 space-y-2">
                {run.receipts.map((r) => (
                  <li key={r.txHash} className="rounded-lg border border-stellar-border/60 bg-stellar-dark/50 p-2.5 text-xs">
                    <div className="font-semibold text-slate-200">{r.step}</div>
                    <div className="mt-0.5 text-slate-400">{r.detail}</div>
                    <ExtLink href={explorerTxUrl(NETWORK, r.txHash)} className="mt-1 font-mono text-[11px]">
                      {shortAddr(r.txHash, 10, 6)}
                    </ExtLink>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <NoteBox>No recorded run yet. Run scripts/e2e-testnet.mjs to record one.</NoteBox>
          )}
        </Card>
      </div>
    </Section>
  );
}
