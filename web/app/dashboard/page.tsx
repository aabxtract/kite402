'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Coins, MousePointerClick } from 'lucide-react';
import { EndpointCard } from '../../components/EndpointCard';
import { WalletPanel } from '../../components/WalletPanel';
import { CreateEndpointForm } from '../../components/CreateEndpointForm';
import { ConnectWalletCTA } from '../../components/ConnectWalletCTA';
import { Modal } from '../../components/Modal';
import { BTN_PRIMARY } from '../../lib/ui';
import { PROXY_URL } from '../../lib/proxyUrl';

interface Endpoint {
  slug: string;
  protectedUrl: string;
  priceHbar?: string | null;
  priceUsdc?: string | null;
  maxRequestsPerDay: number | null;
  createdAt: string | null;
  isActive: boolean | null;
  requestCount?: number | string;
  clickCount?: number | string;
}

export default function Dashboard() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [owner, setOwner] = useState('');
  const [input, setInput] = useState('');
  const [showLookup, setShowLookup] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (account: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${PROXY_URL}/admin/endpoints?owner=${encodeURIComponent(account)}`
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
      const res = await fetch(`${PROXY_URL}/admin/endpoints`, {
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
      setShowLookup(true);
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

  function refreshEndpoints() {
    if (authenticated) {
      loadForSignedInUser();
    } else if (owner) {
      load(owner);
    }
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-dim">
          {authenticated
            ? 'Your wallet, your paid endpoints, and everything they earn.'
            : 'Connect your wallet to register endpoints and track earnings.'}
        </p>
      </div>

      {!ready && (
        <div className="h-32 animate-pulse rounded-lg border border-line bg-surface" />
      )}

      {ready && !authenticated && (
        <div className="space-y-4 rounded-lg border border-dashed border-line p-8 text-center">
          <p className="font-sans text-sm text-dim">
            Sign in to provision an embedded Hedera account, register endpoints, and view your
            balance — all from here.
          </p>
          <div className="flex justify-center">
            <ConnectWalletCTA />
          </div>
          <button
            onClick={() => setShowLookup((v) => !v)}
            className="cursor-pointer font-sans text-sm text-dim underline underline-offset-2 hover:text-ink transition-colors"
          >
            {showLookup ? 'hide' : 'or look up an account without signing in'}
          </button>

          {showLookup && (
            <div className="mx-auto flex max-w-md gap-2 pt-2 text-left">
              <label htmlFor="owner-lookup" className="sr-only">
                Hedera account ID
              </label>
              <input
                id="owner-lookup"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                placeholder="0.0.12345"
                className="w-full rounded-md border border-line bg-paper px-3 py-2.5 font-sans text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-amber/50 transition-colors"
              />
              <button onClick={handleLookup} disabled={!input.trim() || loading} className={BTN_PRIMARY}>
                {loading ? '…' : 'look up'}
              </button>
            </div>
          )}
        </div>
      )}

      {authenticated && <WalletPanel />}

      {authenticated && endpoints.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-line p-4">
            <Coins className="h-5 w-5 text-mint" strokeWidth={1.75} />
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">
                {endpoints.reduce((sum, ep) => sum + Number(ep.requestCount ?? 0), 0)}
              </p>
              <p className="font-sans text-xs text-dim">total sales</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-line p-4">
            <MousePointerClick className="h-5 w-5 text-ink/70" strokeWidth={1.75} />
            <div>
              <p className="font-display text-xl font-semibold tracking-tight">
                {endpoints.reduce((sum, ep) => sum + Number(ep.clickCount ?? 0), 0)}
              </p>
              <p className="font-sans text-xs text-dim">total clicks</p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="max-w-md rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-sans text-sm text-alert">
          {error}
        </p>
      )}

      {(authenticated || owner) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">Your links</h2>
            {authenticated && (
              <button onClick={() => setShowCreateModal(true)} className={BTN_PRIMARY}>
                Create 402 link
              </button>
            )}
          </div>

          {!loading && !error && endpoints.length === 0 && (
            <div className="rounded-lg border border-dashed border-line p-8 text-center">
              <p className="font-sans text-sm text-dim">
                {authenticated ? 'No links yet — create one above.' : `No endpoints for ${owner} yet.`}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {endpoints.map((ep) => (
              <EndpointCard key={ep.slug} {...ep} />
            ))}
          </div>
        </section>
      )}

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <div className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">Register a new endpoint</h2>
            <span className="font-sans text-xs text-dim">~10 seconds</span>
          </div>
          <CreateEndpointForm onCreated={refreshEndpoints} />
        </div>
      </Modal>
    </div>
  );
}
