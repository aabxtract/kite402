import type { ReactNode } from 'react';
import { Archivo, JetBrains_Mono, IBM_Plex_Sans } from 'next/font/google';
import Link from 'next/link';
import Providers from './providers';
import { AuthButton } from '../components/AuthButton';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-archivo',
});

const jbMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jbmono',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex',
});

export const metadata = {
  title: 'x402 Gateway — any URL, now payable',
  description:
    'Paste a URL, set a price in HBAR or USDC, get a protected endpoint. Payments settle on Hedera; every access is logged to HCS.',
};

const HCS_TOPIC = '0.0.9765159';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${jbMono.variable} ${plexSans.variable}`}>
      <body className="min-h-screen bg-ink text-paper font-sans antialiased flex flex-col">
        <Providers>
        <header className="border-b border-line">
          <div className="mx-auto max-w-5xl px-5 py-4 flex items-center justify-between">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight">
              <span className="text-amber">402</span>
              <span className="text-dim">·</span>
              <span>gateway</span>
            </Link>
            <nav className="flex items-center gap-6 font-mono text-xs">
              <Link href="/dashboard" className="text-dim hover:text-paper transition-colors">
                dashboard
              </Link>
              <a
                href={`https://hashscan.io/testnet/topic/${HCS_TOPIC}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-dim hover:text-paper transition-colors"
              >
                audit trail ↗
              </a>
              <AuthButton />
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-5 py-12 flex-1">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto max-w-5xl px-5 py-5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-dim">
            <span>settles on hedera:testnet</span>
            <span>
              HCS topic{' '}
              <a
                href={`https://hashscan.io/testnet/topic/${HCS_TOPIC}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-paper/70 hover:text-paper transition-colors underline underline-offset-2"
              >
                {HCS_TOPIC}
              </a>
            </span>
          </div>
        </footer>
        </Providers>
      </body>
    </html>
  );
}
