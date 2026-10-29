'use client';

import React, { useState } from 'react';
import { ArrowDown, CheckCircle2, ChevronDown, Fuel, ArrowRightLeft } from 'lucide-react';

export function SwapCard() {
  const [sourceChain, setSourceChain] = useState<'Arbitrum' | 'Ethereum' | 'Base' | 'Solana'>('Arbitrum');
  const [amountIn, setAmountIn] = useState('500');
  const [targetAsset, setTargetAsset] = useState<'XLM' | 'Spiko T-Bills' | 'Blend Pool' | 'USDC'>('Spiko T-Bills');

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
          <span>Source Asset</span>
          <span>Balance: 1,420.50 USDC</span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <input
            type="number"
            value={amountIn}
            onChange={(e) => setAmountIn(e.target.value)}
            className="bg-transparent text-2xl font-bold text-white focus:outline-none w-full"
            placeholder="0.00"
          />
          <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold shrink-0 cursor-pointer hover:bg-slate-800">
            <span>{sourceChain} USDC</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Down arrow */}
      <div className="flex justify-center -my-2 relative z-10">
        <div className="w-8 h-8 rounded-full bg-stellar-border flex items-center justify-center text-slate-300 border-2 border-stellar-card shadow">
          <ArrowDown className="w-4 h-4 text-stellar-blue" />
        </div>
      </div>

      {/* To Card */}
      <div className="bg-stellar-dark/60 rounded-xl p-4 border border-stellar-border/60 mt-2 mb-4">
        <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
          <span>Target Allocation (Soroban)</span>
          <span className="text-emerald-400 font-medium">Envelope Sponsored</span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <div className="text-2xl font-bold text-slate-100">
            {(parseFloat(amountIn || '0') * 0.998).toFixed(2)}
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-stellar-blue/20 to-stellar-accent/20 border border-stellar-blue/40 px-3 py-1.5 rounded-lg text-xs font-semibold text-stellar-blue shrink-0 cursor-pointer">
            <span>{targetAsset}</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Routing details */}
      <div className="bg-slate-900/40 rounded-lg p-3 text-xs space-y-2 mb-5 border border-slate-800/60">
        <div className="flex justify-between text-slate-400">
          <span>Transport Protocol</span>
          <span className="text-slate-200 font-mono">Circle CCTP (Native Burn & Mint)</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Routing Venue</span>
          <span className="text-slate-200 font-mono">Soroswap Aggregator V3</span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Destination Fee</span>
          <span className="text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Sponsored by Paymaster
          </span>
        </div>
        <div className="flex justify-between text-slate-400">
          <span>Protocol Service Fee</span>
          <span className="text-slate-300 font-mono">0.15% ($0.75)</span>
        </div>
      </div>

      <button className="w-full py-3.5 rounded-xl bg-gradient-to-r from-stellar-blue via-indigo-600 to-stellar-accent hover:opacity-95 text-white font-semibold text-sm shadow-lg shadow-stellar-blue/25 flex items-center justify-center gap-2 transition active:scale-[0.99]">
        <ArrowRightLeft className="w-4 h-4" />
        <span>Submit Cross-Chain Intent</span>
      </button>
    </div>
  );
}
