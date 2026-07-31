import { Hono } from 'hono';

const app = new Hono();
app.post('/test', async (c) => {
  const body = await c.req.json();
  return c.json(body);
});

Bun.serve({ port: 3003, fetch: app.fetch });
console.log('listening on 3003');
