'use client';

import { usePrivy } from '@privy-io/react-auth';

export function AuthButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) {
    return (
      <div className="h-9 w-20 animate-pulse rounded-md bg-surface" />
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
        <span className="hidden sm:inline font-mono text-xs text-dim">{label}</span>
        <button
          onClick={logout}
          className="cursor-pointer rounded-md border border-line px-3 py-1.5 font-mono text-xs text-dim transition-colors hover:border-alert/50 hover:text-alert focus:outline-none"
        >
          sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="cursor-pointer rounded-md bg-amber px-4 py-1.5 font-mono text-xs font-bold text-ink transition-colors hover:bg-amber/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
    >
      sign in
    </button>
  );
}
