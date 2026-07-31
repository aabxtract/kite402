'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useHederaAccount } from '../lib/useHederaAccount';
import { BTN_PRIMARY } from '../lib/ui';
import { Spinner } from './Spinner';
import { PROXY_URL } from '../lib/proxyUrl';

const TINYBARS_PER_HBAR = 100_000_000;

export function WalletPanel() {
  const { authenticated } = usePrivy();
  const { userRecord, balanceHbar, isSyncing, syncError, syncUser, signRawHash, getAccessToken } = useHederaAccount();

  // Withdraw state
  const [withdrawDest, setWithdrawDest] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ transactionId: string; hashscanUrl: string } | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [showWithdraw, setShowWithdraw] = useState(false);

  async function handleWithdraw() {
    if (!withdrawDest.trim() || !withdrawAmount.trim()) return;
    setIsWithdrawing(true);
    setWithdrawError(null);
    setWithdrawResult(null);
    try {
      const amountTinybars = Math.round(parseFloat(withdrawAmount) * TINYBARS_PER_HBAR);
      if (amountTinybars <= 0) throw new Error('Invalid amount');

      const token = await getAccessToken();
      const authHeaders = { Authorization: `Bearer ${token}` };

      const prepareRes = await fetch(`${PROXY_URL}/api/user/withdraw/prepare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ destination: withdrawDest.trim(), amountTinybars }),
      });
      const prepared = await prepareRes.json();
      if (!prepareRes.ok) throw new Error(prepared.error || 'Could not prepare withdrawal');

      const signatureHex = await signRawHash(prepared.hashToSign);

      const execRes = await fetch(`${PROXY_URL}/api/user/withdraw/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ withdrawalId: prepared.withdrawalId, signatureHex }),
      });
      const executed = await execRes.json();
      if (!execRes.ok) throw new Error(executed.error || 'Withdrawal failed');

      setWithdrawResult({ transactionId: executed.transactionId, hashscanUrl: executed.hashscanUrl });
      setWithdrawDest('');
      setWithdrawAmount('');
      await syncUser();
    } catch (e: any) {
      setWithdrawError(e.message || 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  }

  if (!authenticated) return null;

  const balanceDisplay = (Number(balanceHbar) / TINYBARS_PER_HBAR).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });

  return (
    <div className="rounded-lg border border-line bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold tracking-tight">Wallet Balance</h3>
        <button
          onClick={syncUser}
          disabled={isSyncing}
          className="cursor-pointer font-sans text-sm text-dim hover:text-ink transition-colors disabled:opacity-40"
        >
          {isSyncing ? 'syncing…' : '↻ refresh'}
        </button>
      </div>

      {syncError && (
        <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-sans text-sm text-alert">
          {syncError}
        </p>
      )}

      {isSyncing && !userRecord && (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5 text-dim" />
        </div>
      )}

      {userRecord && (
        <>
          {/* Account ID */}
          <div className="space-y-1">
            <p className="font-sans text-sm text-dim">Hedera Account</p>
            {userRecord.hederaAccountId ? (
              <div className="flex items-center gap-2">
                <code className="rounded-md border border-line bg-ink px-3 py-1.5 font-mono text-sm text-mint">
                  {userRecord.hederaAccountId}
                </code>
                <a
                  href={`https://hashscan.io/testnet/account/${userRecord.hederaAccountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-sm text-dim hover:text-ink transition-colors"
                >
                  HashScan ↗
                </a>
              </div>
            ) : (
              <Spinner className="h-4 w-4 text-dim" />
            )}
          </div>

          {/* Balance */}
          <div className="space-y-1">
            <p className="font-sans text-sm text-dim">Balance</p>
            <p className="font-display text-2xl font-semibold tracking-tight">
              {balanceDisplay}{' '}
              <span className="text-base text-dim">HBAR</span>
            </p>
          </div>

          {/* Withdraw toggle */}
          {userRecord.hederaAccountId && (
            <div className="border-t border-line pt-4 space-y-3">
              <button
                onClick={() => setShowWithdraw(!showWithdraw)}
                className="cursor-pointer font-sans text-sm text-mint hover:text-mint/80 transition-colors"
              >
                {showWithdraw ? '▾ hide withdraw' : '▸ withdraw earnings'}
              </button>

              {showWithdraw && (
                <div className="space-y-3 rounded-md border border-line bg-raised p-4">
                  <div className="space-y-1.5">
                    <label className="block font-sans text-sm text-dim">Destination account</label>
                    <input
                      value={withdrawDest}
                      onChange={(e) => setWithdrawDest(e.target.value)}
                      placeholder="0.0.12345 or wallet address"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-amber/50 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-sans text-sm text-dim">Amount (HBAR)</label>
                    <input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="1.0"
                      inputMode="decimal"
                      className="w-full rounded-md border border-line bg-paper px-3 py-2 font-sans text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-amber/50 transition-colors"
                    />
                    <p className="font-sans text-xs text-dim/70">
                      Platform fee: 0.1 HBAR per withdrawal
                    </p>
                  </div>

                  {withdrawError && (
                    <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-sans text-sm text-alert">
                      {withdrawError}
                    </p>
                  )}
                  {withdrawResult && (
                    <p className="rounded-md border border-mint/40 bg-mint/10 px-3 py-2 font-sans text-sm text-mint">
                      Sent.{' '}
                      <a
                        href={withdrawResult.hashscanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2"
                      >
                        view on HashScan ↗
                      </a>
                    </p>
                  )}

                  <button
                    onClick={handleWithdraw}
                    disabled={isWithdrawing || !withdrawDest.trim() || !withdrawAmount.trim()}
                    className={`w-full ${BTN_PRIMARY}`}
                  >
                    {isWithdrawing ? 'signing & submitting…' : 'withdraw'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
