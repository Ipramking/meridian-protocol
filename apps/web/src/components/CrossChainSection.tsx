'use client';

import React, { useEffect, useState } from 'react';
import { MeridianSDK, type CrossChainQuoteResponse, type SourceChain } from '@meridian-protocol/sdk';
import { ArrowRight } from 'lucide-react';
import { Card, ErrorBox, Input, Loading, NoteBox, Section, Stat } from './ui';
import { errorMessage, fmtAmount } from '@/lib/meridian';

const CHAINS: { id: SourceChain; label: string }[] = [
  { id: 'ethereum', label: 'Ethereum' },
  { id: 'arbitrum', label: 'Arbitrum' },
  { id: 'base', label: 'Base' },
  { id: 'optimism', label: 'Optimism' },
  { id: 'avalanche', label: 'Avalanche' },
  { id: 'polygon', label: 'Polygon PoS' },
  { id: 'solana', label: 'Solana' },
];

const sdk = new MeridianSDK();

export function CrossChainSection() {
  const [chain, setChain] = useState<SourceChain>('arbitrum');
  const [amount, setAmount] = useState('250');
  const [finality, setFinality] = useState<'fast' | 'standard'>('standard');
  const [quote, setQuote] = useState<CrossChainQuoteResponse>();
  const [quotedAt, setQuotedAt] = useState<string>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuote(undefined);
    setError(undefined);
    if (!(Number(amount) > 0)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const q = await sdk.getQuote({ sourceChain: chain, amountIn: amount, finality });
        if (!cancelled) {
          setQuote(q);
          setQuotedAt(new Date().toLocaleTimeString());
        }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [chain, amount, finality]);

  return (
    <Section
      id="cctp"
      eyebrow="Cross-chain"
      title="CCTP routes into Stellar"
      description="Circle's attestation service (Iris) recognizes Stellar as CCTP domain 27. Quotes below come live from the Iris sandbox API; nothing is estimated locally."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">From</span>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value as SourceChain)}
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-stellar-blue focus:outline-none"
              >
                {CHAINS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">USDC</span>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <label className="block min-w-0">
              <span className="text-[11px] uppercase tracking-wider text-slate-500">Finality</span>
              <select
                value={finality}
                onChange={(e) => setFinality(e.target.value as 'fast' | 'standard')}
                className="min-h-[44px] w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-stellar-blue focus:outline-none"
              >
                <option value="standard">Standard (2000)</option>
                <option value="fast">Fast (1000)</option>
              </select>
            </label>
          </div>

          <div className="mt-5">
            {loading && <Loading label="Asking Circle Iris for the current fee…" />}
            {error && <ErrorBox>Iris quote failed: {error}</ErrorBox>}
            {quote && !loading && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="CCTP fee" value={`${fmtAmount(quote.cctpFee, 7)} (${quote.cctpFeeBps} bps)`} />
                  <Stat label="Relayer fee" value={`${fmtAmount(quote.relayerFee, 7)} (${quote.relayerFeeBps} bps)`} />
                  <Stat label="Arrives on Stellar" value={`${fmtAmount(quote.estimatedOutput, 7)} USDC`} />
                  <Stat label="Domains" value={`${quote.sourceDomain} → ${quote.destinationDomain}`} />
                </div>
                <ol className="space-y-2">
                  {quote.steps.map((s, i) => (
                    <li key={s.name} className="flex gap-3 rounded-xl border border-stellar-border/60 bg-stellar-dark/50 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stellar-blue/15 text-xs font-bold text-stellar-blue">
                        {i + 1}
                      </span>
                      <div className="min-w-0 text-sm">
                        <div className="font-semibold text-white">
                          {s.name} <span className="font-normal text-slate-500">· {s.chain}</span>
                        </div>
                        <div className="text-xs text-slate-400">{s.description}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] text-slate-500">Quoted at {quotedAt} from iris-api-sandbox.circle.com</p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <NoteBox>
            <div className="mb-1 font-semibold text-slate-200">What is live today</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>Live CCTP fee quotes from Circle Iris (sandbox).</li>
              <li>
                <span className="font-mono">MeridianRouter.execute_intent</span> on testnet: a relayer fast-fills an intent
                with its own USDC into the recipient&apos;s wallet or vault. The router never spends its own balance, and
                each fill is recorded by order id so it can&apos;t be replayed.
              </li>
            </ul>
          </NoteBox>
          <NoteBox>
            <div className="mb-1 font-semibold text-slate-200">Not wired yet</div>
            <ul className="list-disc space-y-1 pl-4">
              <li>The origin-chain burn: this page does not connect an EVM or Solana wallet.</li>
              <li>
                On-chain verification of Circle&apos;s attestation. Today the relayer is trusted to check the attested
                message before it fills; since it fills with its own USDC, a bad fill costs the relayer, not users.
              </li>
            </ul>
            <div className="mt-2 flex items-center gap-1 text-slate-300">
              See fills in <a href="#activity" className="inline-flex items-center gap-1 text-stellar-blue hover:underline">Activity <ArrowRight className="h-3 w-3" /></a>
            </div>
          </NoteBox>
        </div>
      </div>
    </Section>
  );
}
