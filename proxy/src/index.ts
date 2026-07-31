import { app } from './app';

console.log('x402 Gateway proxy starting on http://localhost:3001');

Bun.serve({
  port: 3001,
  fetch: app.fetch,
});
