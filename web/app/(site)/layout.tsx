import type { ReactNode } from 'react';
import Link from 'next/link';
import { AuthButton } from '../../components/AuthButton';
import { NavLinks } from '../../components/NavLinks';

/**
 * Marketing/app chrome. Lives here rather than in the root layout so the
 * standalone paywall at /pay/[slug] can render without a navbar or footer —
 * it is shown to people following a paid link, not to signed-in users.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <>
      <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4">
        <div className="flex w-full max-w-5xl items-center justify-between gap-6 rounded-full border border-line bg-paper/80 px-6 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] backdrop-blur-md">
          <Link href="/" className="flex shrink-0 items-center">
            <img src="/logo.png" alt="kite402" className="h-7 w-auto object-contain" />
          </Link>
          <NavLinks />
          <AuthButton />
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-5 pt-28 pb-12">{children}</main>

      <footer className="relative overflow-hidden border-t border-line">
        <div className="relative mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-3">
            <img src="/logo.png" alt="kite402" className="h-7 w-auto object-contain" />
            <p className="max-w-xs font-sans text-sm text-dim">
              Any URL, now payable. Pay-per-call APIs, settled on Hedera over x402.
            </p>
          </div>

          <div className="space-y-3">
            <p className="font-sans text-sm font-semibold text-ink">Product</p>
            <ul className="space-y-2 font-sans text-sm text-dim">
              <li>
                <Link href="/#features" className="transition-opacity hover:opacity-70">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="transition-opacity hover:opacity-70">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/docs" className="transition-opacity hover:opacity-70">
                  Docs
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <p className="font-sans text-sm font-semibold text-ink">Account</p>
            <ul className="space-y-2 font-sans text-sm text-dim">
              <li>
                <Link href="/dashboard" className="transition-opacity hover:opacity-70">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/history" className="transition-opacity hover:opacity-70">
                  History
                </Link>
              </li>
              <li>
                <Link href="/settings" className="transition-opacity hover:opacity-70">
                  Settings
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div aria-hidden className="pointer-events-none flex select-none justify-end overflow-hidden">
          <p className="-mb-8 mr-[-2rem] whitespace-nowrap font-display text-[10rem] font-bold leading-none tracking-tight text-ink/5 sm:text-[13rem]">
            kite402
          </p>
        </div>

        <div className="relative">
          <div className="mx-auto max-w-6xl px-5 pb-8">
            <p className="font-sans text-xs text-dim">© {year} kite402. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
