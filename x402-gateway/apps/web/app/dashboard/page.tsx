'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { EndpointCard } from '../../components/EndpointCard';
import { WalletPanel } from '../../components/WalletPanel';

interface Endpoint {
  slug: string;
  protectedUrl: string;
  priceHbar?: string | null;
  priceUsdc?: string | null;
  maxRequestsPerDay: number | null;
  createdAt: string | null;
  isActive: boolean | null;
  requestCount?: number | string;
}

export default function Dashboard() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [owner, setOwner] = useState('');
  const [input, setInput] = useState('');
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (account: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_PROXY_URL}/admin/endpoints?owner=${encodeURIComponent(account)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Could not load endpoints.');
        setEndpoints([]);
        return;
      }
      setEndpoints(data.endpoints ?? []);
    } catch {
      setError('Gateway unreachable. Is the proxy running on port 3001?');
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadForSignedInUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${process.env.NEXT_PUBLIC_PROXY_URL}/admin/endpoints`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Could not load endpoints.');
        setEndpoints([]);
        return;
      }
      setEndpoints(data.endpoints ?? []);
    } catch {
      setError('Gateway unreachable. Is the proxy running on port 3001?');
      setEndpoints([]);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    if (authenticated) {
      loadForSignedInUser();
      return;
    }
    const saved = localStorage.getItem('x402:owner');
    if (saved) {
      setOwner(saved);
      setInput(saved);
      load(saved);
    }
  }, [ready, authenticated, load, loadForSignedInUser]);

  function handleLookup() {
    const account = input.trim();
    if (!account) return;
    localStorage.setItem('x402:owner', account);
    setOwner(account);
    load(account);
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Your endpoints</h1>
        <p className="text-sm text-dim">
          {authenticated
            ? 'Endpoints and earnings linked to your signed-in account.'
            : 'Look up the paid endpoints registered to a Hedera account.'}
        </p>
      </div>

      {authenticated && <WalletPanel />}

      {!authenticated && (
        <div className="flex max-w-md gap-2">
          <label htmlFor="owner-lookup" className="sr-only">
            Hedera account ID
          </label>
          <input
            id="owner-lookup"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            placeholder="0.0.12345"
            className="w-full rounded-md border border-line bg-surface px-3 py-2.5 font-mono text-sm text-paper placeholder:text-dim/60 focus:outline-none focus:border-amber focus:ring-1 focus:ring-amber transition-colors"
          />
          <button
            onClick={handleLookup}
            disabled={!input.trim() || loading}
            className="cursor-pointer rounded-md bg-amber px-4 py-2.5 font-mono text-sm font-bold text-ink transition-colors hover:bg-amber/85 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {loading ? '…' : 'look up'}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="max-w-md rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-mono text-xs text-alert">
          {error}
        </p>
      )}

      {!loading && (authenticated || owner) && !error && endpoints.length === 0 && (
        <div className="rounded-lg border border-dashed border-line p-8 text-center">
          <p className="font-mono text-sm text-dim">
            {authenticated ? 'No endpoints yet.' : `No endpoints for ${owner} yet.`}
          </p>
          <Link
            href="/#create"
            className="mt-2 inline-block font-mono text-xs text-amber underline underline-offset-2 hover:text-amber/80"
          >
            create your first one →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {endpoints.map((ep) => (
          <EndpointCard key={ep.slug} {...ep} />
        ))}
      </div>
    </div>
  );
}
