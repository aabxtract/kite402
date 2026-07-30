import { defineConfig } from 'drizzle-kit';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// drizzle-kit doesn't inherit env from `bun --env-file`, so load the repo-root .env directly.
if (!process.env.DATABASE_URL) {
  const candidates = [
    typeof import.meta.dirname === 'string' ? resolve(import.meta.dirname, '../../../.env') : null,
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env'),
  ].filter((p): p is string => p !== null);
  for (const path of candidates) {
    try {
      const envFile = readFileSync(path, 'utf8');
      for (const line of envFile.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
        if (m && m[1] && !process.env[m[1]]) process.env[m[1]] = m[2];
      }
      break;
    } catch {
      // try next candidate
    }
  }
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
