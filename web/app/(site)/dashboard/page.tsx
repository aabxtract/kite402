'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Coins, MousePointerClick } from 'lucide-react';
import { EndpointCard } from '../../../components/EndpointCard';
import { WalletPanel } from '../../../components/WalletPanel';
import { CreateEndpointForm } from '../../../components/CreateEndpointForm';
import { Modal } from '../../../components/Modal';
import { RequireAuth } from '../../../components/RequireAuth';
import { BTN_PRIMARY } from '../../../lib/ui';
import { PROXY_URL } from '../../../lib/proxyUrl';

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (ready && authenticated) loadForSignedInUser();
  }, [ready, authenticated, loadForSignedInUser]);

  function refreshEndpoints() {
    if (authenticated) loadForSignedInUser();
  }

  return (
    <RequireAuth>
    <div className="space-y-10">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-dim">
          Your wallet, your paid endpoints, and everything they earn.
        </p>
      </div>

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

      {authenticated && (
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
                No links yet — create one above.
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
    </RequireAuth>
  );
}
