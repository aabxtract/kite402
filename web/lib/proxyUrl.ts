/**
 * Base URL for the gateway API. Empty by default because the Hono app is now
 * served from this same Next.js deployment (see `app/{api/user,p,admin}/[[...route]]`),
 * so relative paths hit the right place in dev and on Vercel alike. Set
 * NEXT_PUBLIC_PROXY_URL only when pointing at a separately-hosted gateway.
 */
export const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL ?? '';
