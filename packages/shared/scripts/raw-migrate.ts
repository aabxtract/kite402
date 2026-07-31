import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log('Running raw SQL schema updates...');
  
  await sql`
    CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "privy_id" text NOT NULL,
        "email" text,
        "hedera_account_id" text,
        "hedera_public_key" text,
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "users_privy_id_unique" UNIQUE("privy_id"),
        CONSTRAINT "users_hedera_account_id_unique" UNIQUE("hedera_account_id")
    );
  `;
  console.log('Created users table (if not exists).');

  try {
    await sql`ALTER TABLE "endpoints" ADD COLUMN "user_id" text;`;
    console.log('Added user_id column to endpoints.');
  } catch (e: any) {
    console.log('Column user_id may already exist or error:', e.message);
  }

  try {
    await sql`ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;`;
    console.log('Added foreign key constraint.');
  } catch (e: any) {
    console.log('Constraint may already exist or error:', e.message);
  }

  console.log('Schema updates complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
