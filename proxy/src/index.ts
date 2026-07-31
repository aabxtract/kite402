import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { proxyRouter } from './routes/proxy';
import { adminRouter } from './routes/admin';
import { userRouter } from './routes/user';

const app = new Hono();

app.use('*', cors());
app.route('/p', proxyRouter);
app.route('/admin', adminRouter);
app.route('/api/user', userRouter);

console.log('x402 Gateway proxy starting on http://localhost:3001');

Bun.serve({
  port: 3001,
  fetch: app.fetch,
});
