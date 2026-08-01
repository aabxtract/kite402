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

app.route('/p', proxyRouter);
app.route('/admin', adminRouter);
app.route('/api/user', userRouter);

