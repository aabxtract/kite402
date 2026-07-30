import { HTTPFacilitatorClient, x402ResourceServer, x402HTTPResourceServer, type RoutesConfig } from '@x402/core/server';
import type { PaymentOption } from '@x402/core/http';
import type { PaymentPayload } from '@x402/core/types';
import { paymentMiddlewareFromHTTPServer } from '@x402/hono';
import { ExactHederaScheme } from '@x402/hedera/exact/server';
import { HEDERA_TESTNET_CAIP2, HBAR_ASSET_ID, HEDERA_TESTNET_USDC, inspectHederaTransaction } from '@x402/hedera';
import type { MiddlewareHandler } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { endpoints } from '@x402-gateway/shared/schema';

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.X402_FACILITATOR_URL!,
});
const hederaScheme = new ExactHederaScheme();

// Facilitator sync is expensive and returns the supported scheme/network kinds.
// Do it once and reuse the initialized server across per-request route configs.
const resourceServer = new x402ResourceServer(facilitatorClient)
  .register(HEDERA_TESTNET_CAIP2, hederaScheme);

let initPromise: Promise<void> | null = null;
function ensureInitialized(): Promise<void> {
  initPromise ??= resourceServer.initialize();
  return initPromise;
}

function buildMiddlewareForRoute(routes: RoutesConfig): MiddlewareHandler {
  const httpServer = new x402HTTPResourceServer(resourceServer, routes);
  return paymentMiddlewareFromHTTPServer(httpServer, undefined, undefined, false);
}

export function createDynamicPaymentMiddleware(): MiddlewareHandler {

  return async (c, next) => {
    const slug = c.req.param('slug');
    if (!slug) return next();

    await ensureInitialized();

    const rows = await db.select().from(endpoints).where(eq(endpoints.id, slug)).limit(1);
    const ep = rows[0];
    if (!ep || !ep.isActive) return c.json({ error: 'Endpoint not found' }, 404);
    if (ep.expiresAt && new Date() > ep.expiresAt) return c.json({ error: 'Endpoint expired' }, 410);

    let payTo = process.env.HEDERA_ACCOUNT_ID!;
    if (ep.userId) {
      const { users } = await import('@x402-gateway/shared/schema');
      const ownerUser = await db.select().from(users).where(eq(users.id, ep.userId)).limit(1).then(r => r[0]);
      if (ownerUser && ownerUser.hederaAccountId) {
        payTo = ownerUser.hederaAccountId;
      }
    }

    const accepts: PaymentOption[] = [];
    if (ep.priceHbar) {
      accepts.push({
        scheme: 'exact' as const,
        network: HEDERA_TESTNET_CAIP2,
        payTo,
        price: { amount: ep.priceHbar, asset: HBAR_ASSET_ID },
      });
    }
    if (ep.priceUsdc) {
      accepts.push({
        scheme: 'exact' as const,
        network: HEDERA_TESTNET_CAIP2,
        payTo,
        price: { amount: ep.priceUsdc, asset: HEDERA_TESTNET_USDC },
      });
    }

    if (accepts.length === 0) {
      return c.json({ error: 'Endpoint has no price configured' }, 500);
    }

    c.set('endpoint', ep);

    const routes: RoutesConfig = {
      accepts,
      unpaidResponseBody: () => Promise.resolve({
        contentType: 'application/json',
        body: { error: 'Payment required' },
      }),
    };

    const paymentSignature = c.req.header('payment-signature') ?? c.req.header('x-payment');
    const paymentPayload = paymentSignature ? parsePaymentPayload(paymentSignature) : undefined;
    if (paymentPayload) {
      c.set('paymentPayload', paymentPayload);
      const inspected = inspectPayload(paymentPayload);
      c.set('payerAddress', inspected?.payer);
      c.set('paymentTxId', inspected?.transactionId);
      const accepted = paymentPayload.accepted as { asset?: string; amount?: string } | undefined;
      c.set('paymentAsset', accepted?.asset);
      c.set('paymentAmount', accepted?.amount);
    }

    const mw = buildMiddlewareForRoute(routes);
    return mw(c, next);
  };
}

function parsePaymentPayload(header: string): PaymentPayload | undefined {
  try {
    return JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
  } catch {
    return undefined;
  }
}

function inspectPayload(payload: PaymentPayload): { transactionId: string; payer: string | undefined } | undefined {
  const txBase64 = (payload.payload as Record<string, unknown>)?.transaction as string | undefined;
  if (!txBase64) return undefined;
  try {
    const inspected = inspectHederaTransaction(txBase64);
    // The tx ID account is the facilitator fee-payer; the real payer is the
    // account debited in the transfer list.
    const allTransfers = [
      ...inspected.hbarTransfers,
      ...Object.values(inspected.tokenTransfers).flat(),
    ];
    const debit = allTransfers.find((t) => BigInt(t.amount) < 0n);
    return {
      transactionId: inspected.transactionId,
      payer: debit?.accountId ?? inspected.transactionIdAccountId,
    };
  } catch {
    return undefined;
  }
}
