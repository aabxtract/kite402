'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useHederaAccount } from '../../lib/useHederaAccount';
import { ConnectWalletCTA } from '../../components/ConnectWalletCTA';
import { BTN_GHOST } from '../../lib/ui';

export default function Settings() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { userRecord } = useHederaAccount();

  if (ready && !authenticated) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <div className="space-y-4 rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-sans text-sm text-dim">Connect your wallet to view account settings.</p>
          <div className="flex justify-center">
            <ConnectWalletCTA />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>

      <div className="max-w-md space-y-5 rounded-xl border border-line p-6">
        <div className="space-y-1">
          <p className="font-sans text-sm text-dim">Email</p>
          <p className="font-sans text-sm text-ink">{user?.email?.address ?? '—'}</p>
        </div>

        <div className="space-y-1">
          <p className="font-sans text-sm text-dim">Hedera account</p>
          {userRecord?.hederaAccountId ? (
            <code className="inline-block rounded-md border border-line bg-ink px-3 py-1.5 font-mono text-sm text-mint">
              {userRecord.hederaAccountId}
            </code>
          ) : (
            <p className="font-sans text-sm text-dim/70">provisioning…</p>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <button onClick={logout} className={BTN_GHOST}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
