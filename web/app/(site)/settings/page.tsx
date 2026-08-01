'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useHederaAccount } from '../../../lib/useHederaAccount';
import { RequireAuth } from '../../../components/RequireAuth';
import { BTN_GHOST } from '../../../lib/ui';

export default function Settings() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { userRecord } = useHederaAccount();
  const [copied, setCopied] = useState(false);

  return (
    <RequireAuth>
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
            <button
              type="button"
              onClick={() => {
                if (userRecord.hederaAccountId) {
                  navigator.clipboard.writeText(userRecord.hederaAccountId);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              title="Click to copy account ID"
              className="group flex items-center gap-2 cursor-pointer rounded-md border border-line bg-paper px-3 py-1.5 font-mono text-sm text-ink hover:bg-raised transition-colors"
            >
              <span>{userRecord.hederaAccountId}</span>
              <span className="font-sans text-xs text-dim group-hover:text-ink transition-colors">
                {copied ? 'copied ✓' : '📋 copy'}
              </span>
            </button>
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
    </RequireAuth>
  );
}
