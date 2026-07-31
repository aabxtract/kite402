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

// Paid endpoints are meant to be called cross-origin by arbitrary agents and
// scripts, so they stay open. /admin and /api/user are authenticated and are
// now served same-origin with the dashboard, so they get no CORS grant.
app.use('/p/*', cors());
app.route('/p', proxyRouter);
app.route('/admin', adminRouter);
app.route('/api/user', userRouter);
