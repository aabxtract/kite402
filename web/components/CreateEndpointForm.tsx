'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useHederaAccount } from '../lib/useHederaAccount';
import { BTN_PRIMARY } from '../lib/ui';
import { Spinner } from './Spinner';
import { PROXY_URL } from '../lib/proxyUrl';

interface CreateResult {
  slug: string;
  protectedUrl: string;
  priceHbar?: string;
  priceUsdc?: string;
}

const TINYBARS_PER_HBAR = 100_000_000;
const UNITS_PER_USDC = 1_000_000;

function toSmallestUnit(value: string, factor: number): string | undefined {
  if (!value.trim()) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return String(Math.round(n * factor));
}

function fromSmallestUnit(value: string | undefined, factor: number): string | null {
  if (!value) return null;
  const n = Number(value) / factor;
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

const inputClass =
  'w-full rounded-md border border-line bg-paper px-3 py-2.5 font-sans text-sm text-ink placeholder:text-dim focus:outline-none focus:ring-1 focus:ring-amber/50 transition-colors';

const labelClass = 'block font-sans text-sm text-dim';

export function CreateEndpointForm({ onCreated }: { onCreated?: () => void } = {}) {
  const { authenticated, getAccessToken } = usePrivy();
  const { userRecord, syncError } = useHederaAccount();
  const linkedAccountId = userRecord?.hederaAccountId ?? null;
  const [url, setUrl] = useState('');
  const [owner, setOwner] = useState('');
  const [priceHbar, setPriceHbar] = useState('');
  const [priceUsdc, setPriceUsdc] = useState('');
  const [maxReqs, setMaxReqs] = useState('1000');
  const [expiry, setExpiry] = useState('');
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'agent' | 'human' | null>(null);

  useEffect(() => {
    if (authenticated) return;
    const saved = localStorage.getItem('x402:owner');
    if (saved) setOwner(saved);
  }, [authenticated]);

  function handleChange(setter: (v: string) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => setter(e.target.value);
  }

  const hbarUnits = toSmallestUnit(priceHbar, TINYBARS_PER_HBAR);
  const usdcUnits = toSmallestUnit(priceUsdc, UNITS_PER_USDC);
  const canSubmit =
    !loading && url.trim() !== '' && (authenticated || owner.trim() !== '') && (!!hbarUnits || !!usdcUnits);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authenticated) {
        const token = await getAccessToken();
        headers.Authorization = `Bearer ${token}`;
      } else {
        localStorage.setItem('x402:owner', owner.trim());
      }

      const res = await fetch(`${PROXY_URL}/admin/endpoints`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: url.trim(),
          ownerAddress: authenticated ? undefined : owner.trim(),
          priceHbar: hbarUnits,
          priceUsdc: usdcUnits,
          maxRequestsPerDay: parseInt(maxReqs, 10) || 1000,
          expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'Could not create the endpoint. Check the fields and try again.');
        return;
      }
      setResult(data as CreateResult);
      setCopied(null);
      onCreated?.();
    } catch {
      setError('Gateway unreachable. Is the proxy running on port 3001?');
    } finally {
      setLoading(false);
    }
  }

  async function copyUrl(text: string, which: 'agent' | 'human') {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-5 rounded-lg border border-line bg-surface p-5">
        <div className="space-y-1.5">
          <label htmlFor="url" className={labelClass}>
            URL to protect
          </label>
          <input
            id="url"
            value={url}
            onChange={handleChange(setUrl)}
            placeholder="https://api.example.com/data"
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="owner" className={labelClass}>
            your Hedera account (receives payments)
          </label>
          {authenticated ? (
            linkedAccountId ? (
              <p className="rounded-md border border-line bg-ink px-3 py-2.5 font-mono text-sm text-mint">
                {linkedAccountId}
              </p>
            ) : syncError ? (
              <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2.5 font-mono text-sm text-alert">
                {syncError}
              </p>
            ) : (
              <div className="flex items-center justify-center rounded-md border border-line bg-ink px-3 py-2.5">
                <Spinner className="h-4 w-4 text-paper" />
              </div>
            )
          ) : (
            <input
              id="owner"
              value={owner}
              onChange={handleChange(setOwner)}
              placeholder="0.0.12345"
              className={inputClass}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="priceHbar" className={labelClass}>
              price · HBAR
            </label>
            <input
              id="priceHbar"
              value={priceHbar}
              onChange={handleChange(setPriceHbar)}
              placeholder="0.1"
              inputMode="decimal"
              className={inputClass}
            />
            <p className="font-mono text-[11px] text-dim/70">
              {hbarUnits ? `= ${Number(hbarUnits).toLocaleString('en-US')} tinybars` : 'leave empty to skip'}
            </p>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="priceUsdc" className={labelClass}>
              price · USDC
            </label>
            <input
              id="priceUsdc"
              value={priceUsdc}
              onChange={handleChange(setPriceUsdc)}
              placeholder="0.001"
              inputMode="decimal"
              className={inputClass}
            />
            <p className="font-mono text-[11px] text-dim/70">
              {usdcUnits ? `= ${Number(usdcUnits).toLocaleString('en-US')} µUSDC` : 'leave empty to skip'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="maxReqs" className={labelClass}>
              max requests / day
            </label>
            <input
              id="maxReqs"
              value={maxReqs}
              onChange={handleChange(setMaxReqs)}
              inputMode="numeric"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="expiry" className={labelClass}>
              expires (optional)
            </label>
            <input
              id="expiry"
              type="datetime-local"
              value={expiry}
              onChange={handleChange(setExpiry)}
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-mono text-xs text-alert">
            {error}
          </p>
        )}

        <button onClick={handleCreate} disabled={!canSubmit} className={`w-full ${BTN_PRIMARY}`}>
          {loading ? 'creating…' : 'Generate protected URL'}
        </button>
      </div>

      <div>
        {result ? (
          <div className="rounded-lg border border-dashed border-mint/50 bg-surface p-5 font-mono text-sm">
            <p className="text-xs text-dim">— endpoint created —</p>

            <p className="mt-4 text-xs text-dim">agent / API URL — for x402-aware clients (scripts, agents)</p>
            <p className="mt-1 break-all rounded-md border border-line bg-ink px-3 py-2 text-mint">
              {result.protectedUrl}
            </p>
            <button
              onClick={() => copyUrl(result.protectedUrl, 'agent')}
              className="mt-2 w-full cursor-pointer rounded-md border border-mint/50 px-4 py-2 text-xs font-semibold text-mint transition-colors hover:bg-mint/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              {copied === 'agent' ? 'copied ✓' : 'copy agent URL'}
            </button>

            <p className="mt-5 text-xs text-dim">human paywall URL — opens in a browser, pay with a Hedera wallet</p>
            <p className="mt-1 break-all rounded-md border border-line bg-ink px-3 py-2 text-amber">
              {typeof window !== 'undefined' ? `${window.location.origin}/pay/${result.slug}` : `/pay/${result.slug}`}
            </p>
            <button
              onClick={() =>
                copyUrl(`${window.location.origin}/pay/${result.slug}`, 'human')
              }
              className="mt-2 w-full cursor-pointer rounded-md border border-mint/50 px-4 py-2 text-xs font-semibold text-mint transition-colors hover:bg-mint/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              {copied === 'human' ? 'copied ✓' : 'copy human URL'}
            </button>

            <dl className="mt-4 space-y-1 text-xs">
              <div className="flex justify-between gap-4">
                <dt className="text-dim">slug</dt>
                <dd>{result.slug}</dd>
              </div>
              {result.priceHbar && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dim">price</dt>
                  <dd>{fromSmallestUnit(result.priceHbar, TINYBARS_PER_HBAR)} HBAR</dd>
                </div>
              )}
              {result.priceUsdc && (
                <div className="flex justify-between gap-4">
                  <dt className="text-dim">price</dt>
                  <dd>{fromSmallestUnit(result.priceUsdc, UNITS_PER_USDC)} USDC</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-dim">network</dt>
                <dd>hedera:testnet</dd>
              </div>
            </dl>

            <p className="mt-4 text-[11px] leading-relaxed text-dim">
              Unpaid requests get a 402 with payment instructions. Paid requests
              are proxied to your URL and logged to HCS.
            </p>
          </div>
        ) : (
          <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-line p-5">
            <p className="max-w-56 text-center font-mono text-xs leading-relaxed text-dim">
              your receipt appears here once the endpoint is created
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
