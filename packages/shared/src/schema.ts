import { pgTable, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  privyId: text('privy_id').notNull().unique(),
  email: text('email'),
  hederaAccountId: text('hedera_account_id').unique(),
  hederaPublicKey: text('hedera_public_key'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const endpoints = pgTable('endpoints', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  ownerAddress: text('owner_address').notNull(),
  encryptedUrl: text('encrypted_url').notNull(),
  encryptionIv: text('encryption_iv').notNull(),
  encryptionTag: text('encryption_tag').notNull(),
  priceHbar: text('price_hbar'),
  priceUsdc: text('price_usdc'),
  maxRequestsPerDay: integer('max_requests_per_day').default(1000),
  expiresAt: timestamp('expires_at'),
  allowlist: jsonb('allowlist'),
  isActive: boolean('is_active').default(true),
  /** Every hit to /p/:slug, paid or not — distinct from accessLogs, which only records paid completions. */
  clickCount: integer('click_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const accessLogs = pgTable('access_logs', {
  id: text('id').primaryKey(),
  endpointId: text('endpoint_id').notNull(),
  txId: text('tx_id').notNull(),
  hcsSequenceNumber: text('hcs_sequence_number'),
  token: text('token'),
  amount: text('amount'),
  consumerAddress: text('consumer_address'),
  jwtJti: text('jwt_jti'),
  createdAt: timestamp('created_at').defaultNow(),
});
