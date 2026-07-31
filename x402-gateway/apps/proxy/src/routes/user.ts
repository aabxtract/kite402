import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  AccountCreateTransaction,
  AccountId,
  Hbar,
  PublicKey,
  TransferTransaction,
  TransactionId,
  Status,
} from '@hashgraph/sdk';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { db } from '../db';
import { users } from '@x402-gateway/shared/schema';
import { requirePrivyAuth, fetchPrivyEmail } from '../services/privy';
import {
  fetchBalances,
  getOperatorClient,
  hashscanUrl,
  operatorAccountId,
  parseEcdsaPublicKey,
} from '../services/hedera';
import { logWithdrawalToHCS } from '../services/hcs';

export const userRouter = new Hono();

/** Funded into every newly provisioned account so it can immediately hold assets. */
const INITIAL_BALANCE_TINYBARS = 100_000_000; // 1 HBAR
/** Flat platform fee retained from every withdrawal. */
const WITHDRAWAL_FEE_TINYBARS = 10_000_000; // 0.1 HBAR
/** Headroom left in the account to cover the network fee the user pays for the transfer. */
const NETWORK_FEE_BUFFER_TINYBARS = 5_000_000; // 0.05 HBAR
const MAX_WITHDRAWAL_TX_FEE_TINYBARS = 50_000_000; // 0.5 HBAR cap
/** Prepared withdrawals must be signed and submitted within this window. */
const WITHDRAWAL_TTL_MS = 5 * 60 * 1000;

const HEDERA_ID = /^\d+\.\d+\.\d+$/;
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

userRouter.use('*', requirePrivyAuth);

// ---------------------------------------------------------------------------
// POST /api/user/sync — provision an embedded Hedera account for the Privy user
// ---------------------------------------------------------------------------

const syncSchema = z.object({
  /** Compressed (33-byte) or uncompressed (65-byte) secp256k1 public key, hex. */
  publicKeyHex: z.string().min(1),
  email: z.string().email().optional(),
});

userRouter.post('/sync', zValidator('json', syncSchema), async (c) => {
  const privyId = c.get('privyId');
  const body = c.req.valid('json');

  const existing = await findUser(privyId);
  if (existing?.hederaAccountId) {
    return c.json({ user: existing, created: false });
  }

  let publicKey: PublicKey;
  try {
    publicKey = parseEcdsaPublicKey(body.publicKeyHex);
  } catch (e) {
    return c.json({ error: message(e) }, 400);
  }

  const email = (await fetchPrivyEmail(privyId)) ?? body.email ?? null;

  let accountId: string;
  try {
    const client = getOperatorClient();
    const response = await new AccountCreateTransaction()
      .setKeyWithoutAlias(publicKey)
      .setInitialBalance(Hbar.fromTinybars(INITIAL_BALANCE_TINYBARS))
      .setTransactionMemo(`x402-gateway user ${privyId}`)
      .execute(client);

    const receipt = await response.getReceipt(client);
    if (!receipt.accountId) {
      throw new Error('Hedera returned no account id');
    }
    accountId = receipt.accountId.toString();
  } catch (e) {
    return c.json({ error: `Failed to provision Hedera account: ${message(e)}` }, 502);
  }

  // Upsert rather than insert: two tabs signing in at once would otherwise
  // collide on the privy_id unique constraint.
  await db
    .insert(users)
    .values({
      id: privyId,
      privyId,
      email,
      hederaAccountId: accountId,
      hederaPublicKey: publicKey.toStringRaw(),
    })
    .onConflictDoUpdate({
      target: users.privyId,
      set: { hederaAccountId: accountId, hederaPublicKey: publicKey.toStringRaw(), email },
    });

  const user = await findUser(privyId);
  return c.json({ user, created: true });
});

// ---------------------------------------------------------------------------
// GET /api/user/me — profile plus live on-chain balances
// ---------------------------------------------------------------------------

userRouter.get('/me', async (c) => {
  const privyId = c.get('privyId');
  const user = await findUser(privyId);
  if (!user) return c.json({ error: 'User not found. Call /api/user/sync first.' }, 404);

  let balanceHbar = '0';
  let tokens: Record<string, string> = {};
  let balanceError: string | null = null;

  if (user.hederaAccountId) {
    try {
      const balances = await fetchBalances(user.hederaAccountId);
      balanceHbar = balances.tinybars;
      tokens = balances.tokens;
    } catch (e) {
      balanceError = message(e);
    }
  }

  return c.json({
    user,
    balanceHbar,
    tokens,
    balanceError,
    hashscanUrl: user.hederaAccountId ? hashscanUrl('account', user.hederaAccountId) : null,
    withdrawalFeeTinybars: String(WITHDRAWAL_FEE_TINYBARS),
  });
});

// ---------------------------------------------------------------------------
// GET /api/user/transactions — on-chain history for the embedded account, read
// straight from the Hedera mirror node (nothing is persisted locally).
// ---------------------------------------------------------------------------

userRouter.get('/transactions', async (c) => {
  const privyId = c.get('privyId');
  const user = await findUser(privyId);
  if (!user?.hederaAccountId) {
    return c.json({ error: 'No embedded Hedera account provisioned for this user' }, 404);
  }

  const network = process.env.HEDERA_NETWORK === 'mainnet' ? 'mainnet-public' : 'testnet';
  const url = `https://${network}.mirrornode.hedera.com/api/v1/accounts/${user.hederaAccountId}/transactions?limit=25&order=desc`;

  let data: {
    transactions?: {
      transaction_id: string;
      consensus_timestamp: string;
      name: string;
      result: string;
      transfers?: { account: string; amount: number }[];
      token_transfers?: { token_id: string; account: string; amount: number }[];
    }[];
  };
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Mirror node returned ${res.status}`);
    data = await res.json();
  } catch (e) {
    return c.json({ error: `Could not load transaction history: ${message(e)}` }, 502);
  }

  const usdcTokenId = process.env.HEDERA_NETWORK === 'mainnet' ? '0.0.456858' : '0.0.429274';

  const transactions = (data.transactions ?? []).map((tx) => {
    const own = tx.transfers?.find((t) => t.account === user.hederaAccountId);
    const ownTokenTransfers = (tx.token_transfers ?? []).filter((t) => t.account === user.hederaAccountId);

    return {
      transactionId: tx.transaction_id,
      consensusTimestamp: tx.consensus_timestamp,
      type: tx.name,
      status: tx.result,
      netTinybars: String(own?.amount ?? 0),
      tokenTransfers: ownTokenTransfers.map((t) => ({
        tokenId: t.token_id,
        symbol: t.token_id === usdcTokenId ? 'USDC' : t.token_id,
        decimals: t.token_id === usdcTokenId ? 6 : 0,
        amount: String(t.amount),
      })),
      hashscanUrl: hashscanUrl('transaction', tx.transaction_id),
    };
  });

  return c.json({ transactions });
});

// ---------------------------------------------------------------------------
// Withdrawals — atomic 3-leg transfer, signed by the user's embedded wallet
//
// The gateway never holds the user's key, so the transfer is built and frozen
// here, the body hash is handed to the browser for a raw secp256k1 signature,
// and the signed transaction is submitted on the next call. Holding the frozen
// transaction server-side (rather than round-tripping its bytes) is what stops
// a client from stripping the platform fee leg before signing.
// ---------------------------------------------------------------------------

interface PendingWithdrawal {
  privyId: string;
  transaction: TransferTransaction;
  fromAccountId: string;
  destination: string;
  amountTinybars: number;
  feeTinybars: number;
  expiresAt: number;
}

const pendingWithdrawals = new Map<string, PendingWithdrawal>();

function sweepExpired() {
  const now = Date.now();
  for (const [id, w] of pendingWithdrawals) {
    if (w.expiresAt <= now) pendingWithdrawals.delete(id);
  }
}

const prepareSchema = z.object({
  destination: z.string().min(1),
  amountTinybars: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d*$/)]),
});

userRouter.post('/withdraw/prepare', zValidator('json', prepareSchema), async (c) => {
  sweepExpired();

  const privyId = c.get('privyId');
  const user = await findUser(privyId);
  if (!user?.hederaAccountId || !user.hederaPublicKey) {
    return c.json({ error: 'No embedded Hedera account provisioned for this user' }, 404);
  }

  const amountTinybars = Number(c.req.valid('json').amountTinybars);
  if (!Number.isSafeInteger(amountTinybars) || amountTinybars <= 0) {
    return c.json({ error: 'amountTinybars must be a positive integer' }, 400);
  }
  if (amountTinybars <= WITHDRAWAL_FEE_TINYBARS) {
    return c.json(
      {
        error: `Amount must exceed the ${WITHDRAWAL_FEE_TINYBARS / 1e8} HBAR platform fee`,
        feeTinybars: String(WITHDRAWAL_FEE_TINYBARS),
      },
      400,
    );
  }

  let destination: string;
  try {
    destination = await resolveDestination(c.req.valid('json').destination);
  } catch (e) {
    return c.json({ error: message(e) }, 400);
  }
  if (destination === user.hederaAccountId) {
    return c.json({ error: 'Destination must differ from your own account' }, 400);
  }

  let available: number;
  try {
    available = Number((await fetchBalances(user.hederaAccountId)).tinybars);
  } catch (e) {
    return c.json({ error: `Could not read account balance: ${message(e)}` }, 502);
  }
  if (available < amountTinybars + NETWORK_FEE_BUFFER_TINYBARS) {
    return c.json(
      {
        error: 'Insufficient balance. Leave at least 0.05 HBAR to cover the network fee.',
        balanceTinybars: String(available),
      },
      400,
    );
  }

  const netTinybars = amountTinybars - WITHDRAWAL_FEE_TINYBARS;
  const client = getOperatorClient();

  // Pin a single node so there is exactly one transaction body — and therefore
  // exactly one hash for the browser to sign.
  const nodeAccountId = pickNode();

  const transaction = new TransferTransaction()
    .setTransactionId(TransactionId.generate(AccountId.fromString(user.hederaAccountId)))
    .setNodeAccountIds([nodeAccountId])
    .setMaxTransactionFee(Hbar.fromTinybars(MAX_WITHDRAWAL_TX_FEE_TINYBARS))
    .setTransactionMemo('x402-gateway withdrawal')
    .addHbarTransfer(user.hederaAccountId, Hbar.fromTinybars(-amountTinybars))
    .addHbarTransfer(destination, Hbar.fromTinybars(netTinybars))
    .addHbarTransfer(operatorAccountId(), Hbar.fromTinybars(WITHDRAWAL_FEE_TINYBARS))
    .freezeWith(client);

  const withdrawalId = crypto.randomUUID();
  const expiresAt = Date.now() + WITHDRAWAL_TTL_MS;

  pendingWithdrawals.set(withdrawalId, {
    privyId,
    transaction,
    fromAccountId: user.hederaAccountId,
    destination,
    amountTinybars,
    feeTinybars: WITHDRAWAL_FEE_TINYBARS,
    expiresAt,
  });

  return c.json({
    withdrawalId,
    /** keccak256 of the transaction body — sign this raw, with no message prefix. */
    hashToSign: `0x${Buffer.from(keccak_256(bodyBytes(transaction))).toString('hex')}`,
    destination,
    amountTinybars: String(amountTinybars),
    feeTinybars: String(WITHDRAWAL_FEE_TINYBARS),
    netTinybars: String(netTinybars),
    expiresAt: new Date(expiresAt).toISOString(),
  });
});

const executeSchema = z.object({
  withdrawalId: z.string().min(1),
  signatureHex: z.string().min(1),
});

userRouter.post('/withdraw/execute', zValidator('json', executeSchema), async (c) => {
  sweepExpired();

  const privyId = c.get('privyId');
  const { withdrawalId, signatureHex } = c.req.valid('json');

  const pending = pendingWithdrawals.get(withdrawalId);
  if (!pending || pending.privyId !== privyId) {
    return c.json({ error: 'Unknown or expired withdrawal. Prepare it again.' }, 404);
  }
  // Single-use: drop it before submitting so a retry can never double-spend.
  pendingWithdrawals.delete(withdrawalId);

  const user = await findUser(privyId);
  if (!user?.hederaPublicKey) return c.json({ error: 'User not found' }, 404);

  let signature: Uint8Array;
  try {
    signature = normalizeSignature(signatureHex);
  } catch (e) {
    return c.json({ error: message(e) }, 400);
  }

  const publicKey = PublicKey.fromStringECDSA(user.hederaPublicKey);
  if (!publicKey.verify(bodyBytes(pending.transaction), signature)) {
    return c.json({ error: 'Signature does not match this account key' }, 400);
  }

  const client = getOperatorClient();
  let transactionId: string;
  try {
    pending.transaction.addSignature(publicKey, signature);
    const response = await pending.transaction.execute(client);
    const receipt = await response.getReceipt(client);
    transactionId = response.transactionId.toString();

    if (receipt.status.toString() !== Status.Success.toString()) {
      return c.json({ error: `Transfer failed: ${receipt.status.toString()}`, transactionId }, 502);
    }
  } catch (e) {
    return c.json({ error: `Withdrawal failed: ${message(e)}` }, 502);
  }

  // Audit trail is best-effort — the transfer has already settled.
  let hcsSequenceNumber: string | null = null;
  try {
    const logged = await logWithdrawalToHCS({
      fromAccountId: pending.fromAccountId,
      destination: pending.destination,
      amountTinybars: String(pending.amountTinybars),
      feeTinybars: String(pending.feeTinybars),
      txId: transactionId,
      timestamp: new Date().toISOString(),
    });
    hcsSequenceNumber = logged.sequenceNumber?.toString() ?? null;
  } catch (e) {
    console.error('HCS withdrawal log failed:', message(e));
  }

  return c.json({
    status: 'SUCCESS',
    transactionId,
    hashscanUrl: hashscanUrl('transaction', transactionId),
    destination: pending.destination,
    amountTinybars: String(pending.amountTinybars),
    feeTinybars: String(pending.feeTinybars),
    netTinybars: String(pending.amountTinybars - pending.feeTinybars),
    hcsSequenceNumber,
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function findUser(privyId: string) {
  return db
    .select()
    .from(users)
    .where(eq(users.privyId, privyId))
    .limit(1)
    .then((rows) => rows[0]);
}

/**
 * The bytes the network signs over. A frozen transaction pinned to one node has
 * exactly one body; `signWith` would hand these same bytes to a signer callback.
 */
function bodyBytes(transaction: TransferTransaction): Uint8Array {
  const signed = (transaction as unknown as { _signedTransactions: { list: { bodyBytes: Uint8Array }[] } })
    ._signedTransactions;
  const bytes = signed?.list?.[0]?.bodyBytes;
  if (!bytes) throw new Error('Transaction is not frozen');
  return bytes;
}

function pickNode(): AccountId {
  const nodes = Object.values(getOperatorClient().network) as AccountId[];
  if (nodes.length === 0) throw new Error('No Hedera nodes available');
  return nodes[Math.floor(Math.random() * nodes.length)]!;
}

/** Hedera wants a bare 64-byte r||s; browsers hand back a 65-byte r||s||v. */
function normalizeSignature(signatureHex: string): Uint8Array {
  const hex = signatureHex.replace(/^0x/, '');
  if (!/^[0-9a-fA-F]+$/.test(hex)) throw new Error('signatureHex must be hex');

  const bytes = Uint8Array.from(Buffer.from(hex, 'hex'));
  if (bytes.length === 64) return bytes;
  if (bytes.length === 65) return bytes.subarray(0, 64);
  throw new Error(`Expected a 64- or 65-byte signature, got ${bytes.length} bytes`);
}

/** Accepts `0.0.x` directly, or resolves an EVM address via the mirror node. */
async function resolveDestination(input: string): Promise<string> {
  const destination = input.trim();
  if (HEDERA_ID.test(destination)) return destination;

  if (!EVM_ADDRESS.test(destination)) {
    throw new Error('Destination must be a Hedera account id (0.0.12345) or a 0x EVM address');
  }

  const network = process.env.HEDERA_NETWORK === 'mainnet' ? 'mainnet-public' : 'testnet';
  const url = `https://${network}.mirrornode.hedera.com/api/v1/accounts/${destination}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`No Hedera account is associated with ${destination}`);
  }
  const data = (await res.json()) as { account?: string };
  if (!data.account) throw new Error(`No Hedera account is associated with ${destination}`);
  return data.account;
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export default userRouter;
