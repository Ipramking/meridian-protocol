import React from 'react';
import { Building2, Globe, Shield } from 'lucide-react';

export function FiatRampSection() {
  return (
    <div className="bg-gradient-to-br from-stellar-card via-slate-900 to-stellar-dark border border-stellar-border rounded-2xl p-8 max-w-4xl mx-auto my-12">
      <div className="max-w-2xl">
        <span className="text-xs font-bold text-stellar-blue tracking-wider uppercase">
          SEP-24 & SEP-6 Direct Gateway
        </span>
        <h2 className="text-2xl font-bold text-white mt-1 mb-3">
          Direct EVM-to-Bank Account Fiat Off-Ramp
        </h2>
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          Skip centralized exchange deposits, P2P freezing risks, and high off-ramp fees.
          Bridge USDC directly from Arbitrum, Base, or Optimism and let Meridian’s Soroban smart contract
          trigger an instant SEP-24 fiat payout to local bank accounts across Africa, Latin America, and Europe.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-stellar-border/80">
        <div className="bg-stellar-dark/50 p-4 rounded-xl border border-stellar-border/40">
          <Globe className="w-6 h-6 text-stellar-blue mb-2" />
          <h4 className="font-semibold text-sm text-white mb-1">Global Coverage</h4>
          <p className="text-xs text-slate-400">
            Integrated with Yellow Card, Cowrie, Bitso, and MoneyGram anchors across 180+ countries.
          </p>
        </div>

        <div className="bg-stellar-dark/50 p-4 rounded-xl border border-stellar-border/40">
          <Building2 className="w-6 h-6 text-amber-400 mb-2" />
          <h4 className="font-semibold text-sm text-white mb-1">Direct Bank Payout</h4>
          <p className="text-xs text-slate-400">
            Funds land in local currency (NGN, BRL, KES, EUR, MXN) in 2 to 5 minutes.
          </p>
        </div>

        <div className="bg-stellar-dark/50 p-4 rounded-xl border border-stellar-border/40">
          <Shield className="w-6 h-6 text-emerald-400 mb-2" />
          <h4 className="font-semibold text-sm text-white mb-1">Non-Custodial Escrow</h4>
          <p className="text-xs text-slate-400">
            Soroban time-locked escrow guarantees refund if the anchor fails to disburse within 15 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
