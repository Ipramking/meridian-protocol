import React from 'react';
import { Navbar } from '@/components/Navbar';
import { SwapCard } from '@/components/SwapCard';
import { VaultCard } from '@/components/VaultCard';
import { FiatRampSection } from '@/components/FiatRampModal';
import { SUPPORTED_STELLAR_VAULTS } from '@meridian-protocol/sdk';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-stellar-dark">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stellar-card border border-stellar-border text-xs text-stellar-blue mb-4 shadow-sm">
            <span>Stellar Soroban Mainnet & Circle CCTP</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white mb-4">
            Cross-Chain Capital Settlement for{' '}
            <span className="bg-gradient-to-r from-stellar-blue via-indigo-400 to-stellar-accent bg-clip-text text-transparent">
              Stellar RWAs & Real Yield
            </span>
          </h1>
          <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
            Deterministic liquidity routing from EVM and SVM networks into Stellar institutional vaults,
            Soroban lending pools, and local currency fiat anchors with sponsored envelope execution.
          </p>
        </div>

        {/* Swap Card Centered */}
        <div id="swap" className="flex justify-center mb-16">
          <SwapCard />
        </div>

        {/* Vaults Section */}
        <div id="vaults" className="mb-16">
          <div className="flex justify-between items-end mb-6">
            <div>
              <span className="text-xs font-bold text-stellar-blue uppercase tracking-wider">
                Soroban Real-World Assets
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                Curated Institutional Vaults
              </h2>
            </div>
            <span className="text-xs text-slate-400">Audited Soroban contract interfaces</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUPPORTED_STELLAR_VAULTS.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>
        </div>

        {/* Fiat Off-Ramp Section */}
        <div id="fiat">
          <FiatRampSection />
        </div>
      </main>

      <footer className="border-t border-stellar-border/60 py-8 text-center text-xs text-slate-500">
        <p>© 2026 Meridian Protocol. Maintained by Ipramking for the Stellar Wave Program.</p>
      </footer>
    </div>
  );
}
