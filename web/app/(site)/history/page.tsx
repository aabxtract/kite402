'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { ConnectWalletCTA } from '../../components/ConnectWalletCTA';
import { Spinner } from '../../components/Spinner';
import { PROXY_URL } from '../../lib/proxyUrl';

const TINYBARS_PER_HBAR = 100_000_000;

interface TokenTransfer {
  tokenId: string;
  symbol: string;
  decimals: number;
  amount: string;
}

interface Transaction {
  transactionId: string;
  consensusTimestamp: string;
  type: string;
  status: string;
  netTinybars: string;
  tokenTransfers: TokenTransfer[];
  hashscanUrl: string;
}

function formatHbar(tinybars: string): string {
  const n = Number(tinybars) / TINYBARS_PER_HBAR;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} HBAR`;
}

function formatToken(transfer: TokenTransfer): string {
  const n = Number(transfer.amount) / 10 ** transfer.decimals;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toLocaleString('en-US', { maximumFractionDigits: transfer.decimals })} ${transfer.symbol}`;
}

function formatDate(consensusTimestamp: string): string {
  const seconds = Number(consensusTimestamp.split('.')[0]);
  return new Date(seconds * 1000).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function amountColor(n: number): string {
  return n > 0 ? 'text-mint' : n < 0 ? 'text-ink' : 'text-dim';
}

export default function History() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${PROXY_URL}/api/user/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          setError(typeof data?.error === 'string' ? data.error : 'Could not load transaction history.');
          return;
        }
        setTransactions(data.transactions ?? []);
      } catch {
        setError('Gateway unreachable. Is the proxy running on port 3001?');
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, authenticated, getAccessToken]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">History</h1>
        <p className="max-w-md text-sm text-dim">
          Every on-chain transaction for your embedded Hedera account, read live from the network.
        </p>
      </div>

      {ready && !authenticated && (
        <div className="space-y-4 rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-sans text-sm text-dim">Connect your wallet to view your transaction history.</p>
          <div className="flex justify-center">
            <ConnectWalletCTA />
          </div>
        </div>
      )}

      {authenticated && loading && (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-dim" />
        </div>
      )}

      {authenticated && !loading && error && (
        <p role="alert" className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-sans text-sm text-alert">
          {error}
        </p>
      )}

      {authenticated && !loading && !error && transactions.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="font-sans text-sm text-dim">No transactions yet.</p>
        </div>
      )}

      {authenticated && !loading && !error && transactions.length > 0 && (
        <div className="space-y-3">
          {transactions.map((tx) => {
            const hasHbar = Number(tx.netTinybars) !== 0;
            const hasTokens = tx.tokenTransfers.length > 0;

            return (
              <a
                key={tx.transactionId}
                href={tx.hashscanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-line p-4 transition-opacity hover:opacity-80"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="font-sans text-sm text-ink">{tx.type.replaceAll('_', ' ').toLowerCase()}</p>
                    <p className="font-sans text-xs text-dim">{formatDate(tx.consensusTimestamp)}</p>
                  </div>
                  <p className="font-sans text-xs text-dim">{tx.status.toLowerCase()}</p>
                </div>

                {(hasHbar || hasTokens) && (
                  <div className="mt-3 space-y-1 border-t border-line pt-3 text-right">
                    {hasHbar && (
                      <p className={`font-mono text-sm font-medium ${amountColor(Number(tx.netTinybars))}`}>
                        {formatHbar(tx.netTinybars)}
                      </p>
                    )}
                    {tx.tokenTransfers.map((t) => (
                      <p key={t.tokenId} className={`font-mono text-sm font-medium ${amountColor(Number(t.amount))}`}>
                        {formatToken(t)}
                      </p>
                    ))}
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
