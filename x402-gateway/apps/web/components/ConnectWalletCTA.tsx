'use client';

import { usePrivy } from '@privy-io/react-auth';
import { BTN_GHOST, BTN_PRIMARY } from '../lib/ui';

export function ConnectWalletCTA({ variant = 'solid' }: { variant?: 'solid' | 'outline' }) {
  const { ready, authenticated, login } = usePrivy();

  return (
    <button
      onClick={login}
      disabled={!ready || authenticated}
      className={`group ${variant === 'solid' ? BTN_PRIMARY : BTN_GHOST}`}
    >
      {authenticated ? 'entering dashboard…' : 'Connect wallet'}
      <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </button>
  );
}
