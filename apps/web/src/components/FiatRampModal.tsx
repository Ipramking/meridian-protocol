'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Shield,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import {
  SUPPORTED_STELLAR_ANCHORS,
  Sep24Client,
  SupportedAnchor,
} from '@meridian-protocol/sdk';

export function FiatRampSection() {
  const [selectedAnchor, setSelectedAnchor] = useState<SupportedAnchor>(
    SUPPORTED_STELLAR_ANCHORS[0]
  );
  const [currency, setCurrency] = useState('NGN');
  const [amount, setAmount] = useState('250');
  const [destinationAccount, setDestinationAccount] = useState(
    'GCAAHYYUW26D63RKTKAFNEGKMQFH7UTV544D3QF4GH6PTUBCTSGDIWW5'
  );

  const [isLoadingInfo, setIsLoadingInfo] = useState(false);
  const [assetLimits, setAssetLimits] = useState<{ min: number; max: number } | null>(null);

  const [isInitiating, setIsInitiating] = useState(false);
  const [sessionData, setSessionData] = useState<{
    url: string;
    id: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAnchorInfo = async () => {
      setIsLoadingInfo(true);
      try {
        const client = new Sep24Client(selectedAnchor.domain);
        const info = await client.getInfo();
        const withdrawAsset = info.withdraw[currency] || info.withdraw['USDC'];
        if (isMounted && withdrawAsset) {
          setAssetLimits({
            min: withdrawAsset.minAmount || 10,
            max: withdrawAsset.maxAmount || 50000,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setIsLoadingInfo(false);
      }
    };

    fetchAnchorInfo();
    return () => {
      isMounted = false;
    };
  }, [selectedAnchor, currency]);

  const handleInitiateSep24 = async () => {
    setIsInitiating(true);
    try {
      const client = new Sep24Client(selectedAnchor.domain);
      const res = await client.initiateWithdraw({
        assetCode: 'USDC',
        account: destinationAccount,
        amount,
      });
      setSessionData({
        url: res.url,
        id: res.id,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsInitiating(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-stellar-card via-slate-900 to-stellar-dark border border-stellar-border rounded-2xl p-8 max-w-4xl mx-auto my-12">
      <div className="max-w-2xl mb-8">
        <span className="text-xs font-bold text-stellar-blue tracking-wider uppercase">
          SEP-24 & SEP-6 Direct Gateway
        </span>
        <h2 className="text-2xl font-bold text-white mt-1 mb-2">
          Direct EVM-to-Bank Account Fiat Off-Ramp
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          Skip centralized exchange deposits and P2P freezing risks. Bridge USDC directly from
          Arbitrum, Base, or Optimism and let Meridian’s Soroban smart contract trigger an instant
          SEP-24 fiat payout to local bank accounts across Africa, Latin America, and Europe.
        </p>
      </div>

      {/* Interactive Anchor Terminal */}
      <div className="bg-stellar-dark/80 rounded-xl p-5 border border-stellar-border/80 mb-8">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-stellar-border/60">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white text-sm">
              Integrated Anchor Session Generator
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            {selectedAnchor.isTestnet ? 'Testnet Sandbox' : 'Mainnet'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
              Select Anchor Domain
            </label>
            <select
              value={selectedAnchor.id}
              onChange={(e) => {
                const found = SUPPORTED_STELLAR_ANCHORS.find((a) => a.id === e.target.value);
                if (found) {
                  setSelectedAnchor(found);
                  setCurrency(found.currencies[0]);
                  setSessionData(null);
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {SUPPORTED_STELLAR_ANCHORS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.domain})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
              Off-Ramp Currency
            </label>
            <select
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                setSessionData(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
            >
              {selectedAnchor.currencies.map((c) => (
                <option key={c} value={c}>
                  {c} ({selectedAnchor.regions.join(', ')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wider text-slate-400 mb-1">
              Amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSessionData(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-400">
            {isLoadingInfo ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Fetching anchor limits from {selectedAnchor.domain}...
              </span>
            ) : assetLimits ? (
              <span>
                SEP-24 Min: <strong className="text-slate-200">${assetLimits.min}</strong> | Max:{' '}
                <strong className="text-slate-200">${assetLimits.max.toLocaleString()}</strong>
              </span>
            ) : (
              <span>Standard SEP-24 interactive bank off-ramp</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleInitiateSep24}
            disabled={isInitiating}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-stellar-blue hover:bg-blue-600 text-white font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
          >
            {isInitiating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ArrowRight className="w-3.5 h-3.5" />
            )}
            <span>Initiate SEP-24 Bank Payout Session</span>
          </button>
        </div>

        {sessionData && (
          <div className="mt-4 p-3.5 rounded-lg bg-stellar-blue/10 border border-stellar-blue/30 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-stellar-blue font-semibold">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Interactive Session Generated
              </span>
              <span className="font-mono text-[10px]">Session ID: {sessionData.id}</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              Anchor URL: <code className="text-slate-200 font-mono">{sessionData.url}</code>
            </p>
            <div className="pt-1">
              <a
                href={sessionData.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-white bg-stellar-blue hover:bg-blue-600 px-3 py-1.5 rounded transition font-medium"
              >
                <span>Open Anchor Portal for KYC & Bank Coordinates</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Feature Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-stellar-border/80">
        <div className="bg-stellar-dark/50 p-4 rounded-xl border border-stellar-border/40">
          <Globe className="w-6 h-6 text-stellar-blue mb-2" />
          <h4 className="font-semibold text-sm text-white mb-1">Global Coverage</h4>
          <p className="text-xs text-slate-400">
            Integrated with Cowrie, Yellow Card, Mykobo, and Stellar Reference Anchors.
          </p>
        </div>

        <div className="bg-stellar-dark/50 p-4 rounded-xl border border-stellar-border/40">
          <Building2 className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="font-semibold text-sm text-white mb-1">Direct Bank Payout</h4>
          <p className="text-xs text-slate-400">
            Funds land in local currency (NGN, GHS, EURC, KES) via instant bank transfer rails.
          </p>
        </div>

        <div className="bg-stellar-dark/50 p-4 rounded-xl border border-stellar-border/40">
          <Shield className="w-6 h-6 text-emerald-400 mb-2" />
          <h4 className="font-semibold text-sm text-white mb-1">Non-Custodial Escrow</h4>
          <p className="text-xs text-slate-400">
            Soroban time-locked escrow guarantees refund if the anchor fails to disburse.
          </p>
        </div>
      </div>
    </div>
  );
}
