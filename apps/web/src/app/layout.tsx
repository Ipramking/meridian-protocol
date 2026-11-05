import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Meridian Protocol | USDC routing on Stellar testnet',
  description:
    'Soroban router and USDC vaults with on-chain compliance gating, CCTP fast-fills and a SEP-24 off-ramp. Live on Stellar testnet.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0F19',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-stellar-dark text-slate-100 antialiased">{children}</body>
    </html>
  );
}
