import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '@x402-gateway/shared/schema';

const url = process.env.DATABASE_URL;

if (!url || url === 'postgres://placeholder') {
  console.warn('⚠ DATABASE_URL not configured. DB queries will fail at runtime.');
  console.warn('  Get a free Postgres database at https://console.neon.tech');
}

const sql = url && url !== 'postgres://placeholder' ? neon(url) : null;

export const db = sql
  ? drizzle(sql, { schema })
  : new Proxy(
      {},
      {
        get(_, key) {
          if (key === 'then') return undefined;
          throw new Error(
            'DATABASE_URL not configured. Set a real Neon Postgres URL in .env\n' +
            'Get one free at https://console.neon.tech'
          );
        },
      },
    ) as unknown as ReturnType<typeof drizzle<typeof schema>>;
