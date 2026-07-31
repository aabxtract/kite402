'use client';

import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';

const LOGGED_OUT = [
  { href: '/#features', label: 'Features' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/docs', label: 'Docs' },
];

const LOGGED_IN = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/settings', label: 'Settings' },
];

export function NavLinks() {
  const { authenticated } = usePrivy();
  const links = authenticated ? LOGGED_IN : LOGGED_OUT;

  return (
    <nav className="hidden items-center gap-8 font-sans text-sm sm:flex">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="text-dim transition-opacity hover:opacity-70">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
