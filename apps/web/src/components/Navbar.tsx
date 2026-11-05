'use client';

import React from 'react';
import { LogOut, Wallet } from 'lucide-react';
import { Button } from './ui';
import { useWallet } from './WalletProvider';
import { shortAddr } from '@/lib/meridian';

const LINKS = [
  ['#account', 'Account'],
  ['#vaults', 'Vaults'],
  ['#cctp', 'Cross-chain'],
  ['#activity', 'Activity'],
  ['#offramp', 'Off-ramp'],
  ['#contracts', 'Contracts'],
] as const;

export function Navbar() {
  const { status, address, onTestnet, connect, disconnect } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-stellar-border bg-stellar-dark/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <a href="#top" className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-stellar-blue to-stellar-accent font-bold text-white">
            M
          </div>
          <span className="truncate text-lg font-bold tracking-tight text-white">MERIDIAN</span>
          <span className="hidden rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300 sm:inline">
            Stellar testnet
          </span>
        </a>

        <nav className="hidden items-center gap-5 text-sm text-slate-300 lg:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="transition-colors hover:text-stellar-blue">
              {label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {status === 'connected' && address ? (
            <>
              <span
                className={`hidden rounded-lg border px-3 py-2 font-mono text-xs sm:inline ${
                  onTestnet ? 'border-slate-700 text-slate-200' : 'border-amber-500/40 text-amber-300'
                }`}
                title={address}
              >
                {shortAddr(address)}
                {!onTestnet && ' · wrong network'}
              </span>
              <Button variant="secondary" onClick={disconnect} aria-label="Disconnect wallet" className="px-3">
                <LogOut className="h-4 w-4" />
                <span className="sm:hidden">{shortAddr(address, 3, 3)}</span>
              </Button>
            </>
          ) : status === 'not-installed' ? (
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 text-sm font-semibold text-slate-200"
            >
              <Wallet className="h-4 w-4" /> Install Freighter
            </a>
          ) : (
            <Button onClick={connect} loading={status === 'checking'}>
              <Wallet className="h-4 w-4" /> Connect Freighter
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
