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

  return (
    <div className="mx-auto max-w-lg space-y-6 py-12">
      <div className="space-y-1">
        <p className="font-mono text-xs text-dim">x402 paywall</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Unlock this content</h1>
      </div>

      {loadingChallenge && <p className="font-mono text-sm text-dim">Checking price…</p>}
      {loadError && (
        <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-mono text-xs text-alert">{loadError}</p>
      )}

      {result ? (
        <div className="space-y-3 rounded-lg border border-mint/40 bg-surface p-5">
          <p className="font-mono text-xs text-mint">✓ unlocked</p>
          {result.hcsSequence && (
            <p className="font-mono text-[11px] text-dim">HCS sequence #{result.hcsSequence}</p>
          )}
          {result.contentType?.includes('html') ? (
            <iframe
              srcDoc={result.body}
              className="h-96 w-full rounded-md border border-line bg-white"
              sandbox=""
            />
          ) : (
            <pre className="max-h-96 overflow-auto rounded-md border border-line bg-ink p-3 font-mono text-xs text-paper/90 whitespace-pre-wrap">
              {result.body}
            </pre>
          )}
        </div>
      ) : (
        challenge?.accepts[0] && (
          <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
            <div className="space-y-1">
              <p className="font-mono text-xs text-dim">price</p>
              <p className="font-display text-2xl font-semibold tracking-tight">
                {formatPrice(challenge.accepts[0].asset, challenge.accepts[0].amount)}
              </p>
            </div>

            {accountId ? (
              <p className="font-mono text-xs text-dim">
                connected: <span className="text-mint">{accountId}</span>
              </p>
            ) : (
              <p className="font-mono text-xs text-dim">Connect a Hedera wallet (HashPack, Blade) to pay.</p>
            )}

            {(walletError || payError) && (
              <p className="rounded-md border border-alert/40 bg-alert/10 px-3 py-2 font-mono text-xs text-alert">
                {payError || walletError}
              </p>
            )}

            <button
              onClick={handlePayAndUnlock}
              disabled={connecting || paying}
              className={`w-full ${BTN_PRIMARY}`}
            >
              {connecting ? 'connecting…' : paying ? 'paying…' : accountId ? 'pay & unlock' : 'connect wallet & pay'}
            </button>
          </div>
        )
      )}
    </div>
  );
}
