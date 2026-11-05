import React from 'react';
import { WalletProvider } from '@/components/WalletProvider';
import { Navbar } from '@/components/Navbar';
import { AccountPanel } from '@/components/AccountPanel';
import { VaultsSection } from '@/components/VaultsSection';
import { CrossChainSection } from '@/components/CrossChainSection';
import { ActivitySection } from '@/components/ActivitySection';
import { OffRampSection } from '@/components/OffRampSection';
import { ContractsSection } from '@/components/ContractsSection';

const FLOW = [
  ['Get USDC', 'Buy Circle testnet USDC on the Stellar DEX.'],
  ['Route it', 'MeridianRouter deposits into an allowlisted vault, checking compliance on-chain where required.'],
  ['Arrive cross-chain', 'Relayers fast-fill CCTP intents into a wallet or vault with their own USDC.'],
  ['Cash out', 'Withdraw from the vault and off-ramp through a SEP-24 anchor.'],
] as const;

export default function HomePage() {
  return (
    <WalletProvider>
      <div id="top" className="flex min-h-screen flex-col overflow-x-hidden bg-stellar-dark">
        <Navbar />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4">
          <div className="py-12 sm:py-16">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Live on Stellar testnet · not on mainnet yet
            </span>
            <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Route USDC into Stellar vaults{' '}
              <span className="bg-gradient-to-r from-stellar-blue to-stellar-accent bg-clip-text text-transparent">
                and back out to cash
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
              Meridian is a set of Soroban contracts and an SDK for moving USDC into Stellar: a router that deposits into
              allowlisted, optionally KYC-gated vaults, fast-fills for CCTP transfers, and a SEP-24 off-ramp. Every number
              on this page is read from the chain or from the service named next to it.
            </p>

            <ol className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FLOW.map(([title, body], i) => (
                <li key={title} className="rounded-2xl border border-stellar-border bg-stellar-card p-4">
                  <div className="text-xs font-bold text-stellar-blue">0{i + 1}</div>
                  <div className="mt-1 text-sm font-semibold text-white">{title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
                </li>
              ))}
            </ol>
          </div>

          <AccountPanel />
          <VaultsSection />
          <CrossChainSection />
          <ActivitySection />
          <OffRampSection />
          <ContractsSection />
        </main>

        <footer className="border-t border-stellar-border/60 px-4 py-8 text-center text-xs text-slate-500">
          <p>
            Meridian Protocol · Apache-2.0 ·{' '}
            <a href="https://github.com/Ipramking/meridian-protocol" className="text-slate-400 hover:text-stellar-blue">
              Source on GitHub
            </a>{' '}
            · Maintained by Ipramking
          </p>
        </footer>
      </div>
    </WalletProvider>
  );
}
