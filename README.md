# kite402

Turn any URL into a pay-per-call API. Paste an endpoint, set a price, and kite402
wraps it behind an [x402](https://x402.org) paywall: unpaid callers get an HTTP 402
challenge, pay in HBAR or USDC on Hedera, and the gateway proxies the response —
logging every settlement to a public Hedera Consensus Service topic.

## How it works

```
GET /p/wx7Kd91k2A                 →  402 Payment Required
                                     accepts: 0.1 HBAR · 0.001 USDC

PAYMENT-SIGNATURE: eyJ4NDAy…      →  payer signs, facilitator settles on-chain

GET /p/wx7Kd91k2A  (retry)        →  200 OK
                                     X-HCS-Sequence: 4
                                     X-X402-Receipt: eyJhbGciOi…
```

Upstream URLs are stored AES-256-GCM encrypted, every paid request gets a signed
JWT receipt, and the audit trail is independently verifiable on HashScan.

## Stack

| Piece | What it is |
|---|---|
| `web/` | Next.js 16 app — landing page, dashboard, and the `/pay/:slug` paywall |
| `proxy/` | Hono API — the 402 gateway, admin routes, and embedded-wallet endpoints |
| `packages/shared/` | Drizzle schema + URL encryption, shared by both |

The Hono app is mounted **inside** the Next.js deployment via `hono/vercel`
(`web/app/{p,admin,api/user}/[[...route]]/route.ts`), so the whole thing ships as
a single Vercel project. `proxy/src/index.ts` still runs it standalone under
`Bun.serve` for local work.

Payments settle on Hedera; auth and embedded wallets are handled by Privy; the
database is Postgres (Neon).

## Getting started

Requires [Bun](https://bun.sh) and a Postgres database.

```bash
bun install
cp .env.example .env     # then fill it in — see below
bun run db:push          # create the tables
bun run dev:web          # http://localhost:3000
```

`dev:web` serves the frontend *and* the API together. To run the gateway as its
own process instead, use `bun run dev:proxy` (port 3001) and set
`NEXT_PUBLIC_PROXY_URL=http://localhost:3001`.

### Environment

Server-side — never expose these to the browser:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `HEDERA_ACCOUNT_ID` | Operator account, e.g. `0.0.12345` |
| `HEDERA_PRIVATE_KEY` | Operator key. Pays to provision accounts and submit withdrawals |
| `HEDERA_NETWORK` | `testnet` (default) or `mainnet` |
| `HCS_TOPIC_ID` | Consensus topic for the audit trail |
| `ENCRYPTION_KEY` | 32-byte hex — `openssl rand -hex 32`. Encrypts upstream URLs |
| `JWT_SECRET` | Signs payment receipts |
| `PRIVY_APP_SECRET` | Verifies Privy auth tokens server-side |
| `X402_FACILITATOR_URL` | x402 facilitator, e.g. `https://api.testnet.blocky402.com` |

Client-side (`NEXT_PUBLIC_*` is inlined into the browser bundle — public by design):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_PRIVY_APP_ID` | Required. The build fails without it |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Required by the `/pay/:slug` paywall — free from [Reown](https://cloud.reown.com) |
| `NEXT_PUBLIC_PROXY_URL` | Leave unset unless the gateway is hosted separately |

`ENCRYPTION_KEY` is not rotatable in place: change it and existing endpoints can
no longer be decrypted.

## API

| Route | Purpose |
|---|---|
| `ALL /p/:slug` | The paywall. 402 until paid, then proxies upstream |
| `POST /admin/endpoints` | Register a URL |
| `GET /admin/endpoints` | List your endpoints |
| `POST /api/user/sync` | Provision an embedded Hedera account |
| `GET /api/user/me` | Profile plus live on-chain balance |
| `GET /api/user/transactions` | Account history, read from the mirror node |
| `POST /api/user/withdraw/prepare` | Build and freeze a withdrawal for signing |
| `POST /api/user/withdraw/execute` | Submit it with the browser's signature |
| `GET /api/user/config-check` | Reports which env vars are set — booleans only, never values |

Withdrawals are a two-step signature flow because the gateway never holds a user's
key. `prepare` freezes a three-leg transfer (payout, platform fee, sender debit)
and returns its body hash; the browser signs that hash raw with the embedded
wallet; `execute` attaches the signature and submits. Holding the frozen
transaction server-side is what stops a client from stripping the fee leg before
signing.

## Deploying

Vercel, as one project — the API routes ship with the frontend. Set every variable
above in the project settings, and scope `HEDERA_PRIVATE_KEY` to production only
if you don't want preview deployments spending operator funds.

Two things worth knowing:

- `next.config.ts` marks the Neon, Hedera, and Privy SDKs as
  `serverExternalPackages`. They bind to a runtime `fetch`/WebSocket at import
  time, and bundling them hands that binding `undefined` — which turns every API
  route into a 500.
- Deploy from the repo root, not `web/`, so the workspace packages resolve.

If the deployment 500s, hit `/api/user/config-check` first — a missing variable
is the usual cause, and it names them without leaking values.

## Scripts

```bash
bun run dev:web       # Next.js + API on :3000
bun run dev:proxy     # gateway standalone on :3001
bun run build         # production build
bun run db:push       # sync schema to the database
bun run db:generate   # generate a migration
```

## Status

Testnet. The withdrawal flow was rewritten for serverless (prepared withdrawals
persist to Postgres rather than in-process memory, since `prepare` and `execute`
can land on different instances) and has not yet been exercised end-to-end against
a real wallet.
