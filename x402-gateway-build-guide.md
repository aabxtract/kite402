# x402 Gateway — Complete Build Guide
> No-code reverse proxy that turns any URL into a paid x402 endpoint on Hedera
> Solo build · Next.js frontend + Hono backend · HBAR + USDC multi-token · HCS audit trail

---

## Overview

**What you're shipping:**
A platform where anyone pastes a URL, sets a price, and gets back a protected slug. Consumers hit that slug, get a 402, pay via x402 on Hedera, and the proxy forwards to the original URL. Encrypted upstreams, usage controls, signed JWT receipts, and an HCS audit trail.

**Judging criteria mapping:**
| Criterion | How you hit it |
|---|---|
| Working end-to-end flow | Paste URL → 402 → pay → get data |
| Real on-chain payments | HBAR or USDC settling on Hedera testnet |
| Good use of Hedera rails | `@x402/hedera` for payment + HCS for audit log |

---

## Stack

```
Frontend   Next.js 16 (App Router) + Tailwind
Backend    Hono (Bun runtime, deployed to Railway/Fly)
x402       @x402/core + @x402/hedera + @x402/hono
Hedera     @hashgraph/sdk (HCS + token transfers)
Database   Neon Postgres (slug registry, encrypted URLs)
Crypto     AES-256-GCM for URL encryption
Auth       Wallet signature (pick ONE: HashPack or MetaMask via Hedera EVM — not both)
JWT        jose library (signed receipt tokens)
```

---

## Repository Structure

```
x402-gateway/
├── apps/
│   ├── web/          # Next.js dashboard
│   └── proxy/        # Hono proxy server
├── packages/
│   └── shared/       # Types, crypto utils, DB schema
├── .env.example
└── README.md
```

---

## Phase 1 — Project Setup (Day 1, ~4 hours)

### 1.1 Init monorepo

```bash
mkdir x402-gateway && cd x402-gateway
bun init
mkdir -p apps/web apps/proxy packages/shared
```

### 1.2 Install dependencies

**Proxy (apps/proxy):**
```bash
bun add hono @hono/node-server
bun add @x402/core @x402/hedera @x402/hono
bun add @hashgraph/sdk
bun add @neondatabase/serverless drizzle-orm
bun add jose         # JWT signing
bun add zod          # input validation
```

**Web (apps/web):**
```bash
bun add next@16 react react-dom
bun add @hashgraph/sdk
bun add @neondatabase/serverless drizzle-orm
bun add nanoid       # slug generation
bun add zod
```

> **Next.js 16 note:** v16 replaces `middleware.ts` with `proxy.ts` for edge logic. All proxy logic lives in Hono, so you won't need either file in the Next app. Turbopack is now the default bundler (`next dev` is faster).

### 1.3 Environment variables

```env
# .env.example

# Hedera
HEDERA_ACCOUNT_ID=0.0.XXXXXX
HEDERA_PRIVATE_KEY=302e...
HEDERA_NETWORK=testnet

# HCS Topic (create once, reuse)
HCS_TOPIC_ID=0.0.XXXXXX

# Encryption
ENCRYPTION_KEY=<32-byte hex>   # openssl rand -hex 32

# JWT
JWT_SECRET=<random 64 chars>

# Database
DATABASE_URL=postgres://...

# x402 Facilitator (Hedera testnet)
# ⚠ Verify https://facilitator.x402.org is live on testnet before Day 2.
#    If it's down, you'll need to run the facilitator yourself (scope grenade).
X402_FACILITATOR_URL=https://facilitator.x402.org
```

### 1.4 Database schema (Drizzle)

```typescript
// packages/shared/schema.ts
import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const endpoints = pgTable('endpoints', {
  id: text('id').primaryKey(),           // nanoid slug
  ownerAddress: text('owner_address').notNull(),
  encryptedUrl: text('encrypted_url').notNull(),   // AES-256-GCM
  encryptionIv: text('encryption_iv').notNull(),
  encryptionTag: text('encryption_tag').notNull(),
  priceHbar: text('price_hbar'),         // null if not accepting HBAR
  priceUsdc: text('price_usdc'),         // null if not accepting USDC
  maxRequestsPerDay: integer('max_requests_per_day').default(1000),
  expiresAt: timestamp('expires_at'),
  allowlist: jsonb('allowlist'),         // optional consumer allowlist
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accessLogs = pgTable('access_logs', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull(),
  txId: text('tx_id').notNull(),         // Hedera transaction ID
  hcsSequenceNumber: text('hcs_sequence_number'),
  token: text('token'),                  // HBAR or USDC
  amount: text('amount'),
  consumerAddress: text('consumer_address'),
  jwtJti: text('jwt_jti'),              // receipt JWT ID (for replay protection)
  createdAt: timestamp('created_at').defaultNow(),
});
```

---

## Phase 2 — Encryption Layer (Day 1, ~2 hours)

This is Layer 1 of your security stack. Upstream URLs never touch your DB in plaintext.

```typescript
// packages/shared/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex');

export function encryptUrl(url: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(url, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag,
  };
}

export function decryptUrl(encrypted: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(ALGORITHM, KEY, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

> **Note for demo:** Show that if you query the DB directly, you see encrypted gibberish — not the original URL. One terminal command, one point scored with judges.

---

## Phase 3 — Hono Proxy Server (Day 2–3, core work)

### 3.1 Server entry point

```typescript
// apps/proxy/src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { proxyRouter } from './routes/proxy';
import { adminRouter } from './routes/admin';

const app = new Hono();

app.use('*', cors());
app.route('/p', proxyRouter);      // protected endpoints: /p/:slug
app.route('/admin', adminRouter);  // slug creation API

export default {
  port: 3001,
  fetch: app.fetch,
};
```

### 3.2 x402 middleware setup with Hedera

```typescript
// apps/proxy/src/middleware/x402.ts
import { paymentMiddleware } from '@x402/hono';
import { HederaPaymentHandler } from '@x402/hedera';
import type { Context, Next } from 'hono';
import { db } from '../db';
import { endpoints } from '@x402-gateway/shared/schema';
import { eq } from 'drizzle-orm';

// Initialize Hedera payment handler
const hederaHandler = new HederaPaymentHandler({
  accountId: process.env.HEDERA_ACCOUNT_ID!,
  privateKey: process.env.HEDERA_PRIVATE_KEY!,
  network: 'testnet',
});

// Dynamic middleware that reads price from DB per slug
export async function dynamicX402Middleware(c: Context, next: Next) {
  const slug = c.req.param('slug');
  
  const endpoint = await db
    .select()
    .from(endpoints)
    .where(eq(endpoints.id, slug))
    .limit(1);
  
  if (!endpoint[0] || !endpoint[0].isActive) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Check expiry
  if (endpoint[0].expiresAt && new Date() > endpoint[0].expiresAt) {
    return c.json({ error: 'Endpoint expired' }, 410);
  }

  const ep = endpoint[0];
  
  // Build payment config for multi-token support
  const paymentConfig: Record<string, string> = {};
  if (ep.priceHbar) paymentConfig['HBAR'] = ep.priceHbar;
  if (ep.priceUsdc) paymentConfig['USDC'] = ep.priceUsdc;

  // Apply x402 middleware dynamically
  const middleware = paymentMiddleware({
    handler: hederaHandler,
    facilitatorUrl: process.env.X402_FACILITATOR_URL!,
    payments: paymentConfig,
    // Attach endpoint data to context for downstream use
    onSuccess: async (paymentInfo) => {
      c.set('paymentInfo', paymentInfo);
      c.set('endpoint', ep);
    },
  });

  return middleware(c, next);
}
```

### 3.3 Proxy route with JWT receipt + HCS logging

```typescript
// apps/proxy/src/routes/proxy.ts
import { Hono } from 'hono';
import { dynamicX402Middleware } from '../middleware/x402';
import { issueReceipt } from '../services/jwt';
import { logToHCS } from '../services/hcs';
import { decryptUrl } from '@x402-gateway/shared/crypto';
import { db } from '../db';
import { accessLogs, endpoints } from '@x402-gateway/shared/schema';
import { eq, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export const proxyRouter = new Hono();

proxyRouter.all('/:slug', dynamicX402Middleware, async (c) => {
  const ep = c.get('endpoint');
  const paymentInfo = c.get('paymentInfo');

  // --- Layer 2: Rate limiting check ---
  const today = new Date().toISOString().split('T')[0];
  const todayCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(accessLogs)
    .where(
      sql`endpoint_id = ${ep.id} AND DATE(created_at) = ${today}`
    );

  if (todayCount[0].count >= (ep.maxRequestsPerDay ?? 1000)) {
    return c.json({ error: 'Daily limit reached for this endpoint' }, 429);
  }

  // --- Layer 2b: Allowlist enforcement ---
  if (ep.allowlist && Array.isArray(ep.allowlist) && ep.allowlist.length > 0) {
    if (!ep.allowlist.includes(paymentInfo.payerAddress)) {
      return c.json({ error: 'Consumer not in allowlist' }, 403);
    }
  }

  // --- Layer 3a: Issue signed JWT receipt ---
  const jti = nanoid();
  const receipt = await issueReceipt({
    jti,
    endpointId: ep.id,
    txId: paymentInfo.transactionId,
    token: paymentInfo.token,
    amount: paymentInfo.amount,
    expiresIn: 60, // 60 seconds — covers retries without double-pay
  });

  // --- Layer 3b: Log to HCS (fail-open — consumer still gets data if HCS is slow) ---
  let hcsResult: { sequenceNumber?: bigint | number; transactionId?: string } = {};
  try {
    hcsResult = await logToHCS({
      endpointId: ep.id,
      txId: paymentInfo.transactionId,
      token: paymentInfo.token,
      amount: paymentInfo.amount,
      consumerAddress: paymentInfo.payerAddress,
      jti,
      timestamp: new Date().toISOString(),
    });
  } catch (hcsErr) {
    console.warn('HCS log failed, continuing without audit entry:', hcsErr);
  }

  // --- Log to DB ---
  await db.insert(accessLogs).values({
    id: jti,
    endpointId: ep.id,
    txId: paymentInfo.transactionId,
    hcsSequenceNumber: hcsResult.sequenceNumber?.toString() ?? null,
    token: paymentInfo.token,
    amount: paymentInfo.amount,
    consumerAddress: paymentInfo.payerAddress,
    jwtJti: jti,
  });

  // --- Decrypt upstream URL and forward ---
  const upstreamUrl = decryptUrl(ep.encryptedUrl, ep.encryptionIv, ep.encryptionTag);
  
  const upstreamResponse = await fetch(upstreamUrl, {
    method: c.req.method,
    headers: {
      // Whitelist safe headers to avoid upstream 400s
      ...Object.fromEntries(
        [...c.req.raw.headers.entries()].filter(([k]) =>
          ['accept', 'accept-encoding', 'accept-language', 'cache-control', 'content-type', 'user-agent'].includes(k)
        )
      ),
      'X-X402-Receipt': receipt, // proxy-internal receipt (upstreams can't verify HS256)
    },
    body: c.req.method !== 'GET' ? await c.req.raw.blob() : undefined,
  });

  // ⚠ Rate-limit uses SELECT+INSERT — under concurrent requests you may briefly exceed the cap.
  //    A single atomic upsert into a daily_counters table would fix this for production.

  // Return upstream response + receipt header to consumer
  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.set('X-X402-Receipt', receipt);
  responseHeaders.set('X-Hedera-TX', paymentInfo.transactionId);
  responseHeaders.set('X-HCS-Sequence', hcsResult.sequenceNumber?.toString() ?? '');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    headers: responseHeaders,
  });
});
```

### 3.4 JWT receipt service

```typescript
// apps/proxy/src/services/jwt.ts
import { SignJWT } from 'jose';
import { TextEncoder } from 'util';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

interface ReceiptPayload {
  jti: string;
  endpointId: string;
  txId: string;
  token: string;
  amount: string;
  expiresIn: number; // seconds
}

export async function issueReceipt(payload: ReceiptPayload): Promise<string> {
  return new SignJWT({
    endpointId: payload.endpointId,
    txId: payload.txId,
    token: payload.token,
    amount: payload.amount,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${payload.expiresIn}s`)
    .sign(secret);
}

// Note: HS256 receipt is proxy-internal — the proxy issues it and returns it in response
// headers as proof of payment. Upstreams cannot independently verify it without the JWT_SECRET.
// If upstream verification is needed, switch to RS256/EdDSA with a published JWK.
```

### 3.5 HCS audit trail service

```typescript
// apps/proxy/src/services/hcs.ts
import {
  Client,
  TopicMessageSubmitTransaction,
  PrivateKey,
  TopicId,
} from '@hashgraph/sdk';

const client = Client.forTestnet();
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!)
);

const topicId = TopicId.fromString(process.env.HCS_TOPIC_ID!);

interface HCSLogEntry {
  endpointId: string;
  txId: string;
  token: string;
  amount: string;
  consumerAddress: string;
  jti: string;
  timestamp: string;
}

export async function logToHCS(entry: HCSLogEntry) {
  const message = JSON.stringify({
    v: 1,                          // schema version
    endpoint: entry.endpointId,
    tx: entry.txId,
    token: entry.token,
    amount: entry.amount,
    consumer: entry.consumerAddress,
    jti: entry.jti,
    ts: entry.timestamp,
  });

  const receipt = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .execute(client);

  const txReceipt = await receipt.getReceipt(client);
  
  return {
    sequenceNumber: txReceipt.topicSequenceNumber,
    transactionId: receipt.transactionId.toString(),
  };
}

// Policy: fail-open. If HCS is down, the consumer still gets data.
// The audit entry is missing from HCS but still logged in the DB.
// Caller handles the error and continues.
```

> **HCS topic setup** (run once before launch):
> ```typescript
> import { TopicCreateTransaction } from '@hashgraph/sdk';
> const tx = await new TopicCreateTransaction().execute(client);
> const receipt = await tx.getReceipt(client);
> console.log('Topic ID:', receipt.topicId.toString());
> // Paste this into HCS_TOPIC_ID in .env
> ```

### 3.6 Admin route — slug creation

```typescript
// apps/proxy/src/routes/admin.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { encryptUrl } from '@x402-gateway/shared/crypto';
import { db } from '../db';
import { endpoints } from '@x402-gateway/shared/schema';

export const adminRouter = new Hono();

const createSchema = z.object({
  url: z.string().url(),
  ownerAddress: z.string(),
  priceHbar: z.string().optional(),
  priceUsdc: z.string().optional(),
  maxRequestsPerDay: z.number().default(1000),
  expiresAt: z.string().datetime().optional(),
  allowlist: z.array(z.string()).optional(),
});

adminRouter.post('/endpoints', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');
  
  if (!body.priceHbar && !body.priceUsdc) {
    return c.json({ error: 'At least one token price required' }, 400);
  }

  const slug = nanoid(10);
  const { encrypted, iv, tag } = encryptUrl(body.url);

  await db.insert(endpoints).values({
    id: slug,
    ownerAddress: body.ownerAddress,
    encryptedUrl: encrypted,
    encryptionIv: iv,
    encryptionTag: tag,
    priceHbar: body.priceHbar ?? null,
    priceUsdc: body.priceUsdc ?? null,
    maxRequestsPerDay: body.maxRequestsPerDay,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    allowlist: body.allowlist ?? null,
  });

  return c.json({
    slug,
    protectedUrl: `${process.env.PROXY_BASE_URL}/p/${slug}`,
    priceHbar: body.priceHbar,
    priceUsdc: body.priceUsdc,
    expiresAt: body.expiresAt,
  });
});
```

---

## Phase 4 — Next.js Dashboard (Day 3–4)

### 4.1 Pages structure

```
apps/web/
├── app/
│   ├── page.tsx           # Landing + URL input form
│   ├── dashboard/
│   │   └── page.tsx       # Owner's endpoint list
│   └── p/[slug]/
│       └── page.tsx       # Consumer-facing paywall page
├── components/
│   ├── CreateEndpointForm.tsx
│   ├── EndpointCard.tsx
│   └── AccessControls.tsx
```

### 4.2 Create endpoint form (key component)

```typescript
// apps/web/components/CreateEndpointForm.tsx
'use client';
import { useState } from 'react';

export function CreateEndpointForm() {
  const [url, setUrl] = useState('');
  const [priceHbar, setPriceHbar] = useState('');
  const [priceUsdc, setPriceUsdc] = useState('');
  const [maxReqs, setMaxReqs] = useState('1000');
  const [expiry, setExpiry] = useState('');
  const [result, setResult] = useState<{ protectedUrl: string; slug: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  async function connectWallet() {
    // HashPack: window.hashpack?.connect()
    // MetaMask (Hedera EVM): window.ethereum?.request({ method: 'eth_requestAccounts' })
    // Pick ONE wallet integration. Two is a day of yak-shaving.
    setWalletAddress('0.0.XXXXXX'); // replace with connected address
  }

  async function handleCreate() {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_PROXY_URL}/admin/endpoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          ownerAddress: walletAddress, // from HashPack/MetaMask connect — see wallet auth note below
          priceHbar: priceHbar || undefined,
          priceUsdc: priceUsdc || undefined,
          maxRequestsPerDay: parseInt(maxReqs),
          expiresAt: expiry || undefined,
        }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Paste any URL..."
        className="w-full border rounded p-3"
      />
      
      {/* Multi-token pricing */}
      <div className="grid grid-cols-2 gap-3">
        <input
          value={priceHbar}
          onChange={e => setPriceHbar(e.target.value)}
          placeholder="Price in HBAR (e.g. 0.5)"
          className="border rounded p-3"
        />
        <input
          value={priceUsdc}
          onChange={e => setPriceUsdc(e.target.value)}
          placeholder="Price in USDC (e.g. 0.001)"
          className="border rounded p-3"
        />
      </div>

      {/* Access controls */}
      <div className="grid grid-cols-2 gap-3">
        <input
          value={maxReqs}
          onChange={e => setMaxReqs(e.target.value)}
          placeholder="Max requests/day"
          className="border rounded p-3"
        />
        <input
          type="datetime-local"
          value={expiry}
          onChange={e => setExpiry(e.target.value)}
          className="border rounded p-3"
        />
      </div>

      {/* Wallet connection */}
      <button
        onClick={connectWallet}
        className="w-full border border-gray-300 py-3 rounded font-medium"
      >
        {walletAddress ? `Connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Connect Wallet'}
      </button>

      <button
        onClick={handleCreate}
        disabled={loading || !url || !walletAddress}
        className="w-full bg-black text-white py-3 rounded font-medium"
      >
        {loading ? 'Creating...' : 'Generate Protected URL'}
      </button>

      {result && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <p className="text-sm text-gray-600 mb-1">Your protected URL:</p>
          <code className="text-sm font-mono break-all">{result.protectedUrl}</code>
          <button
            onClick={() => navigator.clipboard.writeText(result.protectedUrl)}
            className="mt-2 text-xs text-blue-600 underline"
          >
            Copy
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## Phase 5 — HCS Topic Setup Script (Day 4, 30 min)

Run this once to create the audit trail topic:

```typescript
// scripts/create-hcs-topic.ts
import { Client, TopicCreateTransaction, PrivateKey } from '@hashgraph/sdk';

const client = Client.forTestnet();
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!)
);

async function main() {
  const txResponse = await new TopicCreateTransaction()
    .setTopicMemo('x402-gateway-audit-trail')
    .execute(client);

  const receipt = await txResponse.getReceipt(client);
  console.log(`✅ HCS Topic created: ${receipt.topicId}`);
  console.log(`HashScan: https://hashscan.io/testnet/topic/${receipt.topicId}`);
  console.log(`\nAdd to .env:\nHCS_TOPIC_ID=${receipt.topicId}`);
}

main();
```

```bash
bun run scripts/create-hcs-topic.ts
```

---

## Phase 6 — Hedera Testnet Setup (Day 1 parallel, 1 hour)

1. Go to [portal.hedera.com](https://portal.hedera.com) → create testnet account
2. Get testnet HBAR from faucet
3. For USDC on testnet — associate the USDC HTS token with your account:

```typescript
// scripts/associate-usdc.ts
import { Client, TokenAssociateTransaction, PrivateKey, AccountId, TokenId } from '@hashgraph/sdk';

// Hedera testnet USDC token ID (verify current ID on HashScan)
const USDC_TOKEN_ID = '0.0.XXXXXX'; // get from @x402/hedera docs

const client = Client.forTestnet();
client.setOperator(process.env.HEDERA_ACCOUNT_ID!, PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY!));

await new TokenAssociateTransaction()
  .setAccountId(AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!))
  .setTokenIds([TokenId.fromString(USDC_TOKEN_ID)])
  .execute(client);
```

---

## Phase 7 — Demo Script (Day 13–14)

Structure your 5-minute demo as follows:

**Minute 0:00–0:45 — Problem setup**
Show the open-meteo URL in a browser. Show the raw JSON. Say: "Anyone can hit this for free. What if I want to monetize it?"

**Minute 0:45–2:00 — Slug creation**
Paste URL into dashboard. Set $0.001 USDC price + 0.5 HBAR alternative. Set 100 req/day cap. Click Generate. Show the protected URL. Open DB viewer — show encrypted URL, never plaintext.

**Minute 2:00–3:30 — Payment flow**
Hit the protected URL in terminal with curl (no payment header). Get 402 response back. Show the x402 payment challenge in the response. Then hit with an x402-enabled client. Payment goes through. Get data back. Show `X-Hedera-TX` and `X-HCS-Sequence` in response headers.

**Minute 3:30–4:30 — On-chain proof**
Open HashScan. Show the USDC/HBAR transfer transaction. Open the HCS topic on HashScan — show the audit log entry with your endpoint ID, TX ID, consumer address, and timestamp. This is your Hedera rails moment.

**Minute 4:30–5:00 — Wrap**
"This is Stripe Checkout for x402. Any URL, any price, HBAR or USDC, auditable on Hedera."

---

## Day-by-Day Timeline

| Day | Work |
|---|---|
| 1 | Repo setup, DB schema, Hedera testnet account, HCS topic creation, encryption module |
| 2 | Hono proxy — x402 middleware, dynamic pricing, proxy forwarding |
| 3 | JWT receipt service, HCS logging service, DB access log writes |
| 4 | Admin route (slug creation), test end-to-end flow manually |
| 5 | Next.js dashboard — landing page, create form, endpoint list |
| 6 | Multi-token UI (HBAR + USDC toggle), access controls form |
| 7 | Buffer / bug fixes, testnet end-to-end run |
| 8 | Polish: error states, copy UX, slug sharing page |
| 9 | Demo recording dry run |
| 10 | Record demo, write README |
| 11–12 | Buffer |
| 13 | Final submission — form, HashScan links, GitHub repo public |

---

## README Checklist (judges read this first)

- [ ] One-line description
- [ ] Architecture diagram (simple ASCII is fine)
- [ ] How to run locally (5 commands max)
- [ ] HashScan links to: payment TX, HCS topic, HCS message
- [ ] Demo video link (top of README)
- [ ] Hedera services used: HTS (HBAR/USDC), HCS
- [ ] x402 packages used: `@x402/core`, `@x402/hedera`, `@x402/hono`

---

## Key Technical Decisions Documented

**Why Hono?** `@x402/hono` is a first-class official package. No adapter code needed.

**Why AES-256-GCM for URL encryption?** Authenticated encryption — tag verifies the ciphertext wasn't tampered with before decryption. No unauthenticated modes.

**Why 60-second JWT expiry?** Long enough for a client to retry a failed network request. Short enough that a stolen receipt is useless by the time it's replayed.

**Why HCS instead of a simple DB log?** HCS gives you tamper-proof ordering. A judge can verify the log independently on HashScan without trusting your server. That's the entire point of using Hedera rails.

**Why multi-token?** Institutions may need USDC (stable, auditable). Individuals may prefer HBAR (lower friction on Hedera). Offering both doubles your addressable market and it costs you one extra DB column.
