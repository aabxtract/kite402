import { Hono, type Context } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { encryptUrl } from '@x402-gateway/shared/crypto';
import { db } from '../db';
import { endpoints, accessLogs, users } from '@x402-gateway/shared/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { optionalPrivyAuth } from '../services/privy';

export const adminRouter = new Hono();

adminRouter.use('*', optionalPrivyAuth);

/**
 * Public origin to build `protectedUrl` from. Prefers the incoming request's
 * origin so Vercel preview/production deployments emit their own hostname
 * without per-environment config; PROXY_BASE_URL still wins when set.
 */
function baseUrl(c: Context): string {
  const configured = process.env.PROXY_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return new URL(c.req.url).origin;
}

function signedInUser(privyId: string | undefined) {
  if (!privyId) return Promise.resolve(undefined);
  return db
    .select()
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1)
    .then((rows) => rows[0]);
}

// Prices are integers in the token's smallest unit:
//   priceHbar — tinybars (1 HBAR = 100,000,000 tinybars)
//   priceUsdc — micro-USDC (1 USDC = 1,000,000 units)
const smallestUnitPrice = z.string().regex(/^[1-9]\d*$/, 'Price must be a positive integer in the smallest unit (tinybars for HBAR, micro-units for USDC)');

const createSchema = z.object({
  url: z.string().url(),
  /** Optional when signed in — the creator's embedded Hedera account is used. */
  ownerAddress: z.string().optional(),
  priceHbar: smallestUnitPrice.optional(),
  priceUsdc: smallestUnitPrice.optional(),
  maxRequestsPerDay: z.number().int().positive().default(1000),
  expiresAt: z.string().datetime().optional(),
  allowlist: z.array(z.string()).optional(),
});

adminRouter.post('/endpoints', zValidator('json', createSchema), async (c) => {
  const body = c.req.valid('json');

  if (!body.priceHbar && !body.priceUsdc) {
    return c.json({ error: 'At least one token price required' }, 400);
  }

  // A signed-in creator's earnings must land in their own embedded account, so
  // the linked account always wins over whatever the form submitted.
  const owner = await signedInUser(c.get('privyId'));
  const ownerAddress = owner?.hederaAccountId ?? body.ownerAddress;

  if (!ownerAddress) {
    return c.json(
      { error: 'ownerAddress is required when not signed in with a provisioned Hedera account' },
      400,
    );
  }

  const slug = nanoid(10);
  const { encrypted, iv, tag } = encryptUrl(body.url);

  await db.insert(endpoints).values({
    id: slug,
    userId: owner?.id ?? null,
    ownerAddress,
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
    protectedUrl: `${baseUrl(c)}/p/${slug}`,
    priceHbar: body.priceHbar,
    priceUsdc: body.priceUsdc,
    expiresAt: body.expiresAt,
  });
});

adminRouter.get('/endpoints', async (c) => {
  const ownerQuery = c.req.query('owner');
  const signedIn = await signedInUser(c.get('privyId'));

  // Signed-in creators get their own endpoints by user id, which keeps working
  // even if their account id changes. Anonymous callers look up by address.
  const filter = signedIn
    ? eq(endpoints.userId, signedIn.id)
    : ownerQuery
      ? eq(endpoints.ownerAddress, ownerQuery)
      : null;

  if (!filter) {
    return c.json({ error: 'owner query param required when not signed in' }, 400);
  }

  const rows = await db
    .select({
      slug: endpoints.id,
      priceHbar: endpoints.priceHbar,
      priceUsdc: endpoints.priceUsdc,
      maxRequestsPerDay: endpoints.maxRequestsPerDay,
      expiresAt: endpoints.expiresAt,
      isActive: endpoints.isActive,
      createdAt: endpoints.createdAt,
      clickCount: endpoints.clickCount,
    })
    .from(endpoints)
    .where(filter)
    .orderBy(desc(endpoints.createdAt))
    .limit(50);

  const counts = await db
    .select({
      endpointId: accessLogs.endpointId,
      count: sql<string>`count(*)`,
    })
    .from(accessLogs)
    .groupBy(accessLogs.endpointId);
  const countMap = new Map(counts.map((r) => [r.endpointId, Number(r.count)]));

  return c.json({
    endpoints: rows.map((r) => ({
      ...r,
      requestCount: countMap.get(r.slug) ?? 0,
      protectedUrl: `${baseUrl(c)}/p/${r.slug}`,
    })),
  });
});
