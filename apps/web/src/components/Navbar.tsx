import React from 'react';
import { ArrowLeftRight, ShieldCheck, Zap } from 'lucide-react';

export function Navbar() {
  return (
    <header className="border-b border-stellar-border bg-stellar-dark/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-stellar-blue to-stellar-accent flex items-center justify-center font-bold text-white shadow-lg shadow-stellar-blue/20">
            M
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-stellar-blue bg-clip-text text-transparent">
              MERIDIAN
            </span>
            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-stellar-accent/20 text-stellar-blue border border-stellar-blue/30">
              Soroban Mainnet & CCTP
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#swap" className="hover:text-stellar-blue transition-colors flex items-center gap-1.5">
            <ArrowLeftRight className="w-4 h-4" /> Cross-Chain Swap
          </a>
          <a href="#vaults" className="hover:text-stellar-blue transition-colors flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" /> RWA & Yield Vaults
          </a>
          <a href="#fiat" className="hover:text-stellar-blue transition-colors flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Fiat Off-Ramp
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition">
            Connect EVM (MetaMask)
          </button>
          <button className="px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-stellar-blue to-stellar-accent hover:opacity-90 text-white shadow-md shadow-stellar-blue/20 transition">
            Connect Stellar (Freighter)
          </button>
        </div>
      </div>
    </header>
  );
}
