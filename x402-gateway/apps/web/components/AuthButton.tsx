'use client';

import { usePrivy } from '@privy-io/react-auth';
import { BTN_GHOST, BTN_PRIMARY } from '../lib/ui';

export function AuthButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <div className="h-9 w-24 animate-pulse rounded-md bg-raised" />
    );
  }

  if (authenticated && user) {
    const label = user.email?.address
      ? user.email.address.split('@')[0]
      : user.wallet?.address
        ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
        : 'account';

    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline font-sans text-sm text-dim">{label}</span>
        <button onClick={logout} className={BTN_GHOST}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button onClick={login} className={BTN_PRIMARY}>
      Connect wallet
    </button>
  );
}
