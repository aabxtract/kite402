import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { proxyRouter } from './routes/proxy';
import { adminRouter } from './routes/admin';
import { userRouter } from './routes/user';

/**
 * The combined Hono app, with no runtime-specific bootstrap attached.
 * Consumed two ways: `index.ts` hands it to `Bun.serve` for standalone/local
 * use, and the Next.js route handlers under `web/app/**\/route.ts` hand it to
 * `hono/vercel`'s `handle()` so the same routes ship as part of the single
 * Vercel deployment.
 */
export const app = new Hono();

// Enable CORS for all endpoints so web frontend on port 3000 can communicate with proxy on port 3001
app.use('*', cors());

// Root health check endpoint
app.get('/', (c) =>
  c.json({
    status: 'ok',
    service: 'x402-gateway-proxy',
    endpoints: {
      proxy: '/p/:slug',
      admin: '/admin/endpoints',
      user: '/api/user/me',
    },
  }),
);

/**
 * Reports which server-side variables the deployment can see, without ever
 * revealing a value — a missing one turns every route into an opaque 500,
 * and on serverless there is otherwise no way to tell from the outside.
 */
app.get('/api/user/config-check', (c) => {
  const present = (v?: string) => Boolean(v && v.trim() && !v.startsWith('302e...'));
  return c.json({
    DATABASE_URL: present(process.env.DATABASE_URL),
    HEDERA_ACCOUNT_ID: present(process.env.HEDERA_ACCOUNT_ID),
    HEDERA_PRIVATE_KEY: present(process.env.HEDERA_PRIVATE_KEY),
    HEDERA_NETWORK: process.env.HEDERA_NETWORK ?? '(unset — defaults to testnet)',
    HCS_TOPIC_ID: present(process.env.HCS_TOPIC_ID),
    ENCRYPTION_KEY: present(process.env.ENCRYPTION_KEY),
    JWT_SECRET: present(process.env.JWT_SECRET),
    PRIVY_APP_ID: present(process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID),
    PRIVY_APP_SECRET: present(process.env.PRIVY_APP_SECRET),
    X402_FACILITATOR_URL: present(process.env.X402_FACILITATOR_URL),
  });
});

app.route('/p', proxyRouter);
app.route('/admin', adminRouter);
app.route('/api/user', userRouter);

/**
 * Unhandled throws would otherwise surface as a bare 500 with no clue what
 * failed — on serverless the stack only exists in the platform log. Log it
 * there and return the message so a misconfigured deployment is diagnosable
 * from the client instead of silently opaque.
 */
app.onError((err, c) => {
  console.error(`[${c.req.method} ${c.req.path}]`, err);
  return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
});

