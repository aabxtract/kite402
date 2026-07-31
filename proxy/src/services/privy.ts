import { PrivyClient } from '@privy-io/server-auth';
import type { MiddlewareHandler } from 'hono';

// The app id is public (it is also shipped to the browser as NEXT_PUBLIC_PRIVY_APP_ID),
// so accept either name. The secret must only ever live server-side.
const appId = process.env.PRIVY_APP_ID || process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

export const privyConfigured = Boolean(appId && appSecret && appSecret !== 'dummy');

let _client: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!privyConfigured) {
    throw new Error(
      'PRIVY_APP_ID (or NEXT_PUBLIC_PRIVY_APP_ID) and PRIVY_APP_SECRET must be set to verify Privy auth tokens',
    );
  }
  _client ??= new PrivyClient(appId!, appSecret!);
  return _client;
}

if (!privyConfigured) {
  console.warn(
    '⚠ Privy is not configured. /api/user routes will fall back to the unverified\n' +
      '  `x-privy-id` dev header. Set PRIVY_APP_SECRET before deploying.',
  );
}

/**
 * Verifies the Privy access token and puts the Privy user id on the context.
 *
 * When Privy credentials are absent (local development), falls back to an
 * unverified `x-privy-id` header so the flow can be exercised without a Privy
 * app. That fallback is refused once credentials are present.
 */
export const requirePrivyAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('authorization');
  const bearer = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (privyConfigured) {
    if (!bearer) {
      return c.json({ error: 'Missing Authorization: Bearer <privy access token>' }, 401);
    }
    try {
      const claims = await getPrivyClient().verifyAuthToken(bearer);
      c.set('privyId', claims.userId);
      return next();
    } catch (e) {
      return c.json({ error: 'Invalid or expired Privy access token' }, 401);
    }
  }

  const devId = c.req.header('x-privy-id');
  if (!devId) {
    return c.json(
      { error: 'Unauthorized. Privy is not configured; send an x-privy-id header for local development.' },
      401,
    );
  }
  c.set('privyId', devId);
  return next();
};

/**
 * Same verification as {@link requirePrivyAuth}, but anonymous callers pass
 * through instead of being rejected. Used by routes that still support the
 * pre-auth "bring your own Hedera account id" flow.
 */
export const optionalPrivyAuth: MiddlewareHandler = async (c, next) => {
  const bearer = c.req.header('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (privyConfigured) {
    if (bearer) {
      try {
        const claims = await getPrivyClient().verifyAuthToken(bearer);
        c.set('privyId', claims.userId);
      } catch {
        // Anonymous is allowed here, so a bad token is simply not a session.
      }
    }
  } else {
    const devId = c.req.header('x-privy-id');
    if (devId) c.set('privyId', devId);
  }

  return next();
};

/** Best-effort email lookup so we never trust a client-supplied address. */
export async function fetchPrivyEmail(privyId: string): Promise<string | null> {
  if (!privyConfigured) return null;
  try {
    const user = await getPrivyClient().getUser(privyId);
    return user.email?.address ?? null;
  } catch {
    return null;
  }
}
