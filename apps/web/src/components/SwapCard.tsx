'use client';

import React, { useState } from 'react';
import { ArrowDown, CheckCircle2, ChevronDown, Fuel, ArrowRightLeft, ExternalLink } from 'lucide-react';
import { MERIDIAN_ROUTER_CONTRACT, MERIDIAN_PAYMASTER_CONTRACT } from '@meridian-protocol/sdk';

const SOURCE_CHAINS = ['Arbitrum', 'Base', 'Ethereum', 'Solana'] as const;
const TARGET_ASSETS = ['Spiko T-Bills', 'Blend Pool', 'XLM', 'USDC'] as const;

export function SwapCard() {
  const [sourceChainIndex, setSourceChainIndex] = useState(0);
  const [targetAssetIndex, setTargetAssetIndex] = useState(0);
  const [amountIn, setAmountIn] = useState('500');
  const [recipient, setRecipient] = useState('GCAAHYYUW26D63RKTKAFNEGKMQFH7UTV544D3QF4GH6PTUBCTSGDIWW5');
  const [submittedIntent, setSubmittedIntent] = useState<null | {
    intentHash: string;
    estimatedOut: string;
    relayerFee: string;
  }>(null);

  const sourceChain = SOURCE_CHAINS[sourceChainIndex];
  const targetAsset = TARGET_ASSETS[targetAssetIndex];
  const numericAmount = parseFloat(amountIn || '0');
  const relayerFee = (numericAmount * 0.0015).toFixed(2);
  const estimatedOut = (numericAmount * 0.998).toFixed(2);

  const handleSimulateIntent = () => {
    const hash =
      '0x' +
      Array.from({ length: 64 }, (_, i) =>
        ((numericAmount * (i + 7) + sourceChainIndex * 13 + targetAssetIndex * 29) % 16)
          .toString(16)
          .slice(0, 1)
      ).join('');
    setSubmittedIntent({
      intentHash: hash,
      estimatedOut,
      relayerFee,
    });
  };

  return (
    <div className="bg-stellar-card border border-stellar-border rounded-2xl p-6 shadow-2xl backdrop-blur-sm max-w-md w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <span>Cross-Chain Intent Router</span>
        </h2>
        <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Fuel className="w-3 h-3" /> Gasless (Zero XLM)
        </span>
      </div>

      {/* From Card */}
      <div className="bg-stellar-dark/60 rounded-xl p-4 border border-stellar-border/60 mb-2">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
          <span>Source Asset (click chain to cycle)</span>
          <span>Balance: 1,420.50 USDC</span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => {
              setAmountIn(e.target.value);
              setSubmittedIntent(null);
            }}
            className="bg-transparent text-2xl font-bold text-white focus:outline-none w-full"
            placeholder="0.00"
          />
          <button
            type="button"
            onClick={() => {
              setSourceChainIndex((i) => (i + 1) % SOURCE_CHAINS.length);
              setSubmittedIntent(null);
            }}
            className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold shrink-0 cursor-pointer hover:bg-slate-800 text-white"
          >
            <span>{sourceChain} USDC</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Down arrow */}
      <div className="flex justify-center -my-2 relative z-10">
        <div className="w-8 h-8 rounded-full bg-stellar-border flex items-center justify-center text-slate-300 border-2 border-stellar-card shadow">
          <ArrowDown className="w-4 h-4 text-stellar-blue" />
        </div>
      </div>

      {/* To Card */}
      <div className="bg-stellar-dark/60 rounded-xl p-4 border border-stellar-border/60 mt-2 mb-3">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
          <span>Target Allocation (Soroban)</span>
          <span className="text-emerald-400 font-medium">Envelope Sponsored</span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <div className="text-2xl font-bold text-slate-100">{estimatedOut}</div>
          <button
            type="button"
            onClick={() => {
              setTargetAssetIndex((i) => (i + 1) % TARGET_ASSETS.length);
              setSubmittedIntent(null);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-stellar-blue/20 to-stellar-accent/20 border border-stellar-blue/40 px-3 py-1.5 rounded-lg text-xs font-semibold text-stellar-blue shrink-0 cursor-pointer"
          >
            <span>{targetAsset}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recipient Stellar Address */}
      <div className="bg-stellar-dark/40 rounded-lg px-3 py-2 border border-stellar-border/40 mb-4">
        <label className="block text-[10px] uppercase tracking-wider text-slate-400 mb-1">
          Destination Stellar Account (G... or C...)
        </label>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="bg-transparent text-xs font-mono text-slate-200 w-full focus:outline-none"
        />
      </div>

      {/* Routing details */}
      <div className="bg-slate-900/40 rounded-lg p-3 text-xs space-y-2 mb-5 border border-slate-800/60">
        <div className="flex justify-between text-slate-400">
          <span>MeridianRouter Contract</span>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${MERIDIAN_ROUTER_CONTRACT}`}
            target="_blank"
            rel="noreferrer"
            className="text-stellar-blue hover:underline font-mono flex items-center gap-1"
          >
            {MERIDIAN_ROUTER_CONTRACT.slice(0, 6)}...{MERIDIAN_ROUTER_CONTRACT.slice(-4)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>MeridianPaymaster</span>
          <a
            href={`https://stellar.expert/explorer/testnet/contract/${MERIDIAN_PAYMASTER_CONTRACT}`}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline font-mono flex items-center gap-1"
          >
            {MERIDIAN_PAYMASTER_CONTRACT.slice(0, 6)}...{MERIDIAN_PAYMASTER_CONTRACT.slice(-4)}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Destination Fee</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Sponsored by Paymaster
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Protocol Service Fee (0.15%)</span>
          <span className="text-slate-300 font-mono">${relayerFee} USDC</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSimulateIntent}
        className="w-full py-3.5 rounded-xl bg-gradient-to-r from-stellar-blue via-indigo-600 to-stellar-accent hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-stellar-blue/25 flex items-center justify-center gap-2 transition active:scale-[0.99]"
      >
        <ArrowRightLeft className="w-4 h-4" />
        <span>Generate & Verify Cross-Chain Intent</span>
      </button>

      {submittedIntent && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
          <div className="font-semibold text-emerald-400 flex items-center justify-between">
            <span>Intent Payload Prepared for Soroban</span>
            <span>Domain 27</span>
          </div>
          <div className="text-slate-300 font-mono text-[11px] break-all">
            Message Hash: {submittedIntent.intentHash.slice(0, 26)}...
          </div>
          <div className="text-slate-400 text-[11px]">
            Target: <span className="text-white font-medium">{submittedIntent.estimatedOut} {targetAsset}</span> via{' '}
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${MERIDIAN_ROUTER_CONTRACT}`}
              target="_blank"
              rel="noreferrer"
              className="text-stellar-blue underline"
            >
              MeridianRouter
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
