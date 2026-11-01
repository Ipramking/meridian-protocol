import React from 'react';
import { Navbar } from '@/components/Navbar';
import { SwapCard } from '@/components/SwapCard';
import { VaultCard } from '@/components/VaultCard';
import { FiatRampSection } from '@/components/FiatRampModal';
import {
  SUPPORTED_STELLAR_VAULTS,
  MERIDIAN_ROUTER_CONTRACT,
  MERIDIAN_PAYMASTER_CONTRACT,
  MERIDIAN_COMPLIANCE_CONTRACT,
} from '@meridian-protocol/sdk';

const DEPLOYED_CONTRACTS = [
  {
    name: 'MeridianRouter',
    role: 'CCTP Intent Settlement & Soroswap Aggregator Dispatch',
    address: MERIDIAN_ROUTER_CONTRACT,
    initTx: 'ceff2fcbb1c61eac260f1bcf7883255d06fd658f7e7ef31d965b2700f2277b98',
  },
  {
    name: 'MeridianPaymaster',
    role: 'Zero-XLM Gas Sponsorship & Automated Fee Rebalancer',
    address: MERIDIAN_PAYMASTER_CONTRACT,
    initTx: '1b906928f8423400fa6f954c5edafbe022f2530074bda462a1b3122a83ef5424',
  },
  {
    name: 'MeridianCompliance',
    role: 'SEP-8 Regulated RWA KYC & Accreditation Gate',
    address: MERIDIAN_COMPLIANCE_CONTRACT,
    initTx: '9e0729de3da687076c282acbdb04fe762e2cbb81f6d8fef27fb7ea8acbfff031',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-stellar-dark">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
        {/* Header Section */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stellar-card border border-stellar-border text-xs text-stellar-blue mb-4 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Live on Stellar Soroban Testnet & Circle CCTP Domain 27</span>
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

        {/* Live Deployed Contracts Section */}
        <div id="contracts" className="mb-16">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-6 gap-2">
            <div>
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                Verified On-Chain Deployments
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                Stellar Soroban Smart Contracts
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              RPC: https://soroban-testnet.stellar.org
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {DEPLOYED_CONTRACTS.map((c) => (
              <div
                key={c.address}
                className="bg-stellar-card border border-stellar-border rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-white text-sm">{c.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Initialized
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{c.role}</p>
                  <div className="bg-slate-900/70 rounded-lg p-2.5 border border-slate-800 mb-3">
                    <div className="text-[10px] text-slate-500 uppercase mb-1">Contract ID</div>
                    <div className="text-xs text-slate-200 font-mono break-all">{c.address}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs pt-2 border-t border-stellar-border/60">
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${c.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-stellar-blue hover:underline font-medium"
                  >
                    View on Stellar Expert →
                  </a>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${c.initTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-slate-200 font-mono text-[11px]"
                  >
                    Init Tx ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
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
