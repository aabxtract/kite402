import { Hono } from 'hono';
import { db } from '../db';
import { accessLogs } from '@x402-gateway/shared/schema';
import { sql } from 'drizzle-orm';
import { decryptUrl } from '@x402-gateway/shared/crypto';
import { issueReceipt } from '../services/jwt';
import { logToHCS } from '../services/hcs';
import { nanoid } from 'nanoid';
import { createDynamicPaymentMiddleware } from '../middleware/x402';

export const proxyRouter = new Hono();

const paymentMiddleware = createDynamicPaymentMiddleware();

proxyRouter.all('/:slug', paymentMiddleware, async (c) => {
  const ep = c.get('endpoint');
  const payerAddress = c.get('payerAddress');

  // Allowlist enforcement (post-payment — pre-payment enforcement would need a scheme-level hook)
  if (ep.allowlist && Array.isArray(ep.allowlist) && ep.allowlist.length > 0) {
    if (!payerAddress || !ep.allowlist.includes(payerAddress)) {
      return c.json({ error: 'Consumer not in allowlist' }, 403);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const todayCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(accessLogs)
    .where(sql`endpoint_id = ${ep.id} AND DATE(created_at) = ${today}`);

  if (todayCount[0] && todayCount[0].count >= (ep.maxRequestsPerDay ?? 1000)) {
    return c.json({ error: 'Daily limit reached for this endpoint' }, 429);
  }

  const txId = c.get('paymentTxId') ?? 'unknown';
  const asset = c.get('paymentAsset');
  const token = asset === '0.0.0' ? 'HBAR' : asset ? 'USDC' : 'unknown';
  const amount = c.get('paymentAmount') ?? '0';

  const jti = nanoid();
  const receipt = await issueReceipt({
    jti,
    endpointId: ep.id,
    txId,
    token,
    amount,
    expiresIn: 60,
  });

  let hcsSequenceNumber: string | undefined;
  try {
    const hcsResult = await logToHCS({
      endpointId: ep.id,
      txId,
      token,
      amount,
      consumerAddress: payerAddress,
      jti,
      timestamp: new Date().toISOString(),
    });
    hcsSequenceNumber = hcsResult.sequenceNumber?.toString();
  } catch (hcsErr) {
    console.warn('HCS log failed, continuing without audit entry:', hcsErr);
  }

  await db.insert(accessLogs).values({
    id: jti,
    endpointId: ep.id,
    txId,
    hcsSequenceNumber,
    token,
    amount,
    consumerAddress: payerAddress,
    jwtJti: jti,
  });

  const upstreamUrl = decryptUrl(ep.encryptedUrl, ep.encryptionIv, ep.encryptionTag);
  const upstreamResponse = await fetch(upstreamUrl, {
    method: c.req.method,
    headers: {
      ...Object.fromEntries(
        [...c.req.raw.headers.entries()].filter(([k]) =>
          ['accept', 'accept-language', 'cache-control', 'content-type', 'user-agent'].includes(k)
        )
      ),
      'X-X402-Receipt': receipt,
    },
    body: c.req.method !== 'GET' ? await c.req.raw.arrayBuffer() : undefined,
  });

  // fetch auto-decompresses the body; forwarding the upstream's encoding
  // headers alongside the decompressed body corrupts the client's decode.
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');
  responseHeaders.set('X-X402-Receipt', receipt);
  responseHeaders.set('X-HCS-Sequence', hcsSequenceNumber ?? '');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
});
