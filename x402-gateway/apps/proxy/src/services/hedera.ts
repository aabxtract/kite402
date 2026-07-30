import {
  AccountBalanceQuery,
  AccountId,
  Client,
  PrivateKey,
  PublicKey,
} from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';

let _client: Client | null = null;

/**
 * Shared operator client. The operator pays for account provisioning and for
 * submitting user-signed withdrawals; it never holds a user's key.
 */
export function getOperatorClient(): Client {
  if (!_client) {
    const accountId = process.env.HEDERA_ACCOUNT_ID;
    const privateKey = process.env.HEDERA_PRIVATE_KEY;
    if (!accountId || !privateKey || privateKey === '302e...') {
      throw new Error(
        'Valid HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY required for on-chain operations',
      );
    }
    _client =
      process.env.HEDERA_NETWORK === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    _client.setOperator(accountId, PrivateKey.fromStringECDSA(privateKey));
  }
  return _client;
}

export function operatorAccountId(): string {
  const id = process.env.HEDERA_ACCOUNT_ID;
  if (!id) throw new Error('HEDERA_ACCOUNT_ID not configured');
  return id;
}

export function hashscanUrl(kind: 'account' | 'transaction' | 'topic', id: string): string {
  const net = process.env.HEDERA_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
  return `https://hashscan.io/${net}/${kind}/${id}`;
}

/**
 * Accepts a compressed (33-byte) or uncompressed (65-byte) secp256k1 public key
 * as hex and returns the SDK key. Throws on anything else — notably on a bare
 * 20-byte EVM address, which cannot be turned back into a public key.
 */
export function parseEcdsaPublicKey(publicKeyHex: string): PublicKey {
  const hex = publicKeyHex.replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]+$/.test(hex)) {
    throw new Error('publicKeyHex must be hex');
  }
  if (hex.length === 40) {
    throw new Error(
      'Received a 20-byte EVM address, not a public key. The client must recover the ' +
        'secp256k1 public key from a signature before calling /sync.',
    );
  }
  if (hex.length === 66) {
    return PublicKey.fromStringECDSA(hex);
  }
  if (hex.length === 130) {
    // Hedera stores ECDSA keys compressed and rejects the uncompressed form,
    // which is what `recoverPublicKey` hands back in the browser.
    const point = secp256k1.Point.fromBytes(Uint8Array.from(Buffer.from(hex, 'hex')));
    return PublicKey.fromStringECDSA(Buffer.from(point.toBytes(true)).toString('hex'));
  }
  throw new Error(
    `Expected a 33-byte compressed or 65-byte uncompressed secp256k1 public key, got ${hex.length / 2} bytes`,
  );
}

export interface AccountBalances {
  /** HBAR balance in tinybars. */
  tinybars: string;
  /** Token balances in each token's smallest unit, keyed by token id. */
  tokens: Record<string, string>;
}

export async function fetchBalances(accountId: string): Promise<AccountBalances> {
  const balance = await new AccountBalanceQuery()
    .setAccountId(AccountId.fromString(accountId))
    .execute(getOperatorClient());

  const tokens: Record<string, string> = {};
  if (balance.tokens) {
    for (const [tokenId, amount] of balance.tokens) {
      tokens[tokenId.toString()] = amount.toString();
    }
  }

  return { tinybars: balance.hbars.toTinybars().toString(), tokens };
}
