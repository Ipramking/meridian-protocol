import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meridian Protocol | Cross-Chain Gateway for Stellar Soroban RWAs',
  description: '1-click intent routing from EVM and Solana to Stellar Soroban RWAs, Blend lending pools, and local fiat anchors.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-stellar-dark text-slate-100">{children}</body>
    </html>
  );
}
