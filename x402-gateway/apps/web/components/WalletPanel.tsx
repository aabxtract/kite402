'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useHederaAccount } from '../lib/useHederaAccount';

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3001';
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
        <h3 className="font-display text-lg font-bold tracking-tight">Embedded Wallet</h3>
        <button
          onClick={syncUser}
          disabled={isSyncing}
          className="cursor-pointer font-mono text-xs text-dim hover:text-paper transition-colors disabled:opacity-40"
        >
          {isSyncing ? 'syncing…' : '↻ refresh'}
        </button>
      </div>

      {syncError && (
        <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-mono text-xs text-alert">
          {syncError}
        </p>
      )}

      {isSyncing && !userRecord && (
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-48 rounded bg-raised" />
          <div className="h-8 w-32 rounded bg-raised" />
        </div>
      )}

      {userRecord && (
        <>
          {/* Account ID */}
          <div className="space-y-1">
            <p className="font-mono text-xs text-dim">Hedera Account</p>
            {userRecord.hederaAccountId ? (
              <div className="flex items-center gap-2">
                <code className="rounded-md border border-line bg-ink px-3 py-1.5 font-mono text-sm text-mint">
                  {userRecord.hederaAccountId}
                </code>
                <a
                  href={`https://hashscan.io/testnet/account/${userRecord.hederaAccountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-dim hover:text-paper transition-colors"
                >
                  HashScan ↗
                </a>
              </div>
            ) : (
              <p className="font-mono text-xs text-dim/60">
                Creating account… (this takes ~10 seconds on first login)
              </p>
            )}
          </div>

          {/* Balance */}
          <div className="space-y-1">
            <p className="font-mono text-xs text-dim">Balance</p>
            <p className="font-display text-2xl font-bold tracking-tight">
              {balanceDisplay}{' '}
              <span className="text-base text-dim">HBAR</span>
            </p>
          </div>

          {/* Withdraw toggle */}
          {userRecord.hederaAccountId && (
            <div className="border-t border-line pt-4 space-y-3">
              <button
                onClick={() => setShowWithdraw(!showWithdraw)}
                className="cursor-pointer font-mono text-xs text-amber hover:text-amber/80 transition-colors"
              >
                {showWithdraw ? '▾ hide withdraw' : '▸ withdraw earnings'}
              </button>

              {showWithdraw && (
                <div className="space-y-3 rounded-md border border-line bg-ink p-4">
                  <div className="space-y-1.5">
                    <label className="block font-mono text-xs text-dim">Destination account</label>
                    <input
                      value={withdrawDest}
                      onChange={(e) => setWithdrawDest(e.target.value)}
                      placeholder="0.0.12345 or wallet address"
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-paper placeholder:text-dim/60 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-mono text-xs text-dim">Amount (HBAR)</label>
                    <input
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="1.0"
                      inputMode="decimal"
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-paper placeholder:text-dim/60 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
                    />
                    <p className="font-mono text-[11px] text-dim/70">
                      Platform fee: 0.1 HBAR per withdrawal
                    </p>
                  </div>

                  {withdrawError && (
                    <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-mono text-xs text-alert">
                      {withdrawError}
                    </p>
                  )}
                  {withdrawResult && (
                    <p className="rounded-md border border-mint/40 bg-mint/10 px-3 py-2 font-mono text-xs text-mint">
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
                    className="w-full cursor-pointer rounded-md bg-amber px-4 py-2.5 font-mono text-sm font-bold text-ink transition-colors hover:bg-amber/85 disabled:cursor-not-allowed disabled:opacity-40"
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
