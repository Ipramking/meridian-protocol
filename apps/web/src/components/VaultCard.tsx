import React from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { SUPPORTED_STELLAR_VAULTS, SupportedRwaVault } from '@meridian-protocol/sdk';

export function VaultCard({ vault }: { vault: SupportedRwaVault }) {
  return (
    <div className="bg-stellar-card border border-stellar-border hover:border-stellar-blue/50 rounded-2xl p-5 transition duration-300 shadow-xl flex flex-col justify-between group">
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-stellar-accent/15 text-stellar-blue border border-stellar-blue/20">
            {vault.assetType.replace('_', ' ')}
          </span>
          <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>{vault.apyEstimate} APY</span>
          </div>
        </div>

        <h3 className="font-bold text-slate-100 text-base mb-1 group-hover:text-stellar-blue transition-colors">
          {vault.name}
        </h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {vault.description}
        </p>

        <div className="text-xs text-slate-400 space-y-1.5 py-2 border-t border-stellar-border/60">
          <div className="flex justify-between">
            <span>Issuer / Custodian</span>
            <span className="text-slate-200 font-medium">{vault.issuer}</span>
          </div>
          <div className="flex justify-between">
            <span>Underlying Asset</span>
            <span className="text-slate-200 font-medium">{vault.baseAsset}</span>
          </div>
        </div>
      </div>

      <button className="mt-4 w-full py-2.5 rounded-lg bg-slate-800 hover:bg-stellar-blue/20 hover:text-stellar-blue hover:border-stellar-blue/40 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition">
        <span>1-Click Deposit from Arbitrum</span>
        <ArrowUpRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
