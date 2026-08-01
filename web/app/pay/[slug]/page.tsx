'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { x402Client, x402HTTPClient } from '@x402/core/client';
import type { PaymentRequired } from '@x402/core/types';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import { HBAR_ASSET_ID, HEDERA_TESTNET_CAIP2, HEDERA_TESTNET_USDC } from '@x402/hedera';
import { useHederaWalletConnect } from '../../../lib/useHederaWalletConnect';
import { createHederaWalletConnectSigner } from '../../../lib/hederaWalletConnectSigner';
import { BTN_PRIMARY } from '../../../lib/ui';
import { PROXY_URL } from '../../../lib/proxyUrl';
import { Spinner } from '../../../components/Spinner';

const TINYBARS_PER_HBAR = 100_000_000;
const UNITS_PER_USDC = 1_000_000;

function formatPrice(asset: string, amount: string): string {
  if (asset === HBAR_ASSET_ID) return `${(Number(amount) / TINYBARS_PER_HBAR).toLocaleString('en-US', { maximumFractionDigits: 8 })} HBAR`;
  if (asset === HEDERA_TESTNET_USDC) return `${(Number(amount) / UNITS_PER_USDC).toLocaleString('en-US', { maximumFractionDigits: 6 })} USDC`;
  return `${amount} (asset ${asset})`;
}

interface PaidResult {
  body: string;
  contentType: string | null;
  hcsSequence: string | null;
}

export default function PayPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const url = `${PROXY_URL}/p/${slug}`;

  const { accountId, connecting, error: walletError, connect } = useHederaWalletConnect();
  const [challenge, setChallenge] = useState<PaymentRequired | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [result, setResult] = useState<PaidResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingChallenge(true);
      setLoadError(null);
      try {
        const res = await fetch(url);
        if (res.status === 402) {
          const httpClient = new x402HTTPClient(new x402Client());
          const paymentRequired = httpClient.getPaymentRequiredResponse(
            (name) => res.headers.get(name),
            await res.clone().json().catch(() => undefined),
          );
          if (!cancelled) setChallenge(paymentRequired);
          return;
        }
        if (res.ok) {
          const body = await res.text();
          if (!cancelled) {
            setResult({ body, contentType: res.headers.get('content-type'), hcsSequence: res.headers.get('x-hcs-sequence') });
          }
          return;
        }
        if (!cancelled) setLoadError(`Endpoint returned ${res.status}`);
      } catch {
        if (!cancelled) setLoadError('Could not reach the gateway. Is the proxy running?');
      } finally {
        if (!cancelled) setLoadingChallenge(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);

  async function handlePayAndUnlock() {
    setPaying(true);
    setPayError(null);
    try {
      const { signer } = await connect();
      const walletSigner = createHederaWalletConnectSigner(signer);

      const client = new x402Client().register(HEDERA_TESTNET_CAIP2, new ExactHederaScheme(walletSigner));
      const httpClient = new x402HTTPClient(client);

      const first = await fetch(url);
      if (first.status !== 402) throw new Error(`Expected a 402 challenge, got ${first.status}`);
      const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name) => first.headers.get(name),
        await first.clone().json().catch(() => undefined),
      );

      const payload = await client.createPaymentPayload(paymentRequired);
      const headers = httpClient.encodePaymentSignatureHeader(payload);

      const paid = await fetch(url, { headers });
      if (!paid.ok) {
        const errBody = await paid.text().catch(() => '');
        throw new Error(errBody || `Payment was not accepted (${paid.status})`);
      }

      const body = await paid.text();
      setResult({
        body,
        contentType: paid.headers.get('content-type'),
        hcsSequence: paid.headers.get('x-hcs-sequence'),
      });
    } catch (e: any) {
      setPayError(e?.message || 'Payment failed');
    } finally {
      setPaying(false);
    }
  }

  // Once paid, the content is the point — give it the full width instead of
  // keeping it boxed inside the paywall card.
  if (result) {
    return (
      <div className="min-h-screen bg-paper px-5 py-10">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-sm text-mint">✓ unlocked</p>
            {result.hcsSequence && (
              <p className="font-mono text-xs text-dim">HCS sequence #{result.hcsSequence}</p>
            )}
          </div>
          {result.contentType?.includes('html') ? (
            <iframe
              srcDoc={result.body}
              className="h-[70vh] w-full rounded-xl border border-line bg-white"
              sandbox=""
            />
          ) : (
            <pre className="max-h-[70vh] overflow-auto rounded-xl border border-line bg-surface p-4 font-mono text-xs text-ink whitespace-pre-wrap">
              {result.body}
            </pre>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-10">
      {/* Dimmed backdrop so the card reads as a modal over the gated content. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-ink/85" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full blur-[130px]"
        style={{ background: 'rgba(91,141,239,0.18)' }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-paper p-8 shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
      >
        <div className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="kite402" className="h-6 w-auto object-contain" />
          <h1 id="paywall-title" className="mt-5 font-display text-2xl font-semibold tracking-tight">
            Unlock this content
          </h1>
          <p className="mt-2 font-sans text-sm text-dim">
            This link is protected by an x402 paywall. Pay once with a Hedera wallet to view it.
          </p>
        </div>

        {loadingChallenge && (
          <div className="mt-8 flex justify-center">
            <Spinner className="h-5 w-5 text-dim" />
          </div>
        )}

        {loadError && (
          <p className="mt-6 rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-sans text-sm text-alert">
            {loadError}
          </p>
        )}

        {challenge?.accepts[0] && (
          <div className="mt-8 space-y-5">
            <div className="rounded-xl border border-line bg-surface px-5 py-4 text-center">
              <p className="font-sans text-xs uppercase tracking-wide text-dim">price</p>
              <p className="mt-1 font-display text-3xl font-semibold tracking-tight">
                {formatPrice(challenge.accepts[0].asset, challenge.accepts[0].amount)}
              </p>
            </div>

            {accountId ? (
              <p className="text-center font-sans text-xs text-dim">
                connected: <span className="text-mint">{accountId}</span>
              </p>
            ) : (
              <p className="text-center font-sans text-xs text-dim">
                Connect a Hedera wallet (HashPack, Blade) to pay.
              </p>
            )}

            {(walletError || payError) && (
              <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-sans text-sm text-alert">
                {payError || walletError}
              </p>
            )}

            <button
              onClick={handlePayAndUnlock}
              disabled={connecting || paying}
              className={`w-full ${BTN_PRIMARY}`}
            >
              {connecting ? 'connecting…' : paying ? 'paying…' : accountId ? 'Pay & unlock' : 'Connect wallet & pay'}
            </button>

            <p className="text-center font-sans text-xs text-dim">
              Payment settles on Hedera and is logged to a public HCS topic.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
