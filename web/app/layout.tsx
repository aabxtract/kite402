import type { ReactNode } from 'react';
import { Montserrat, JetBrains_Mono, Karla } from 'next/font/google';
import Providers from './providers';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-montserrat',
});

const jbMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jbmono',
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-karla',
});

export const metadata = {
  title: 'kite402 — any URL, now payable',
  description:
    'Paste a URL, set a price in HBAR or USDC, get a protected endpoint. Payments settle on Hedera; every access is logged to HCS.',
};

/**
 * Only html/body, fonts and providers. The navbar and footer live in the
 * (site) group layout so /pay/[slug] can render as a bare, focused paywall.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${montserrat.variable} ${jbMono.variable} ${karla.variable}`}>
      <body className="min-h-screen bg-paper text-ink font-sans antialiased flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
