// Spike: prove a Hedera TransferTransaction can be signed by an EXTERNAL signer
// (the exact call shape Privy rawSign would fill: bytes in -> 64-byte r||s out),
// without the SDK ever holding the private key at signing time.
import {
  Client,
  TransferTransaction,
  PrivateKey,
  Hbar,
  AccountId,
  TransactionId,
} from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const consumerId = process.env.CONSUMER_ACCOUNT_ID!;
const consumerKeyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');

// The SDK key object is used ONLY to derive the public key (Privy exposes public keys too).
const sdkKey = PrivateKey.fromStringECDSA(consumerKeyHex);
const publicKey = sdkKey.publicKey;

// --- This function stands in for Privy's rawSign API call. ---
// It receives raw bytes from the SDK, hashes with keccak256, signs with
// secp256k1, returns 64-byte r||s — exactly what a remote signer returns.
// In production this body becomes: await privy.walletApi.rawSign({ hash })
async function externalSigner(message: Uint8Array): Promise<Uint8Array> {
  const hash = keccak_256(message);
  const keyBytes = Uint8Array.from(Buffer.from(consumerKeyHex, 'hex'));
  return secp256k1.sign(hash, keyBytes); // 64-byte r||s
}

const client = Client.forTestnet();
// Operator only pays the query fee for getReceipt; tx fee payer is the consumer.
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!)
);

try {
  const tx = new TransferTransaction()
    .setTransactionId(TransactionId.generate(AccountId.fromString(consumerId)))
    .addHbarTransfer(consumerId, Hbar.fromTinybars(-100_000_000)) // -1 HBAR
    .addHbarTransfer(process.env.HEDERA_ACCOUNT_ID!, Hbar.fromTinybars(99_000_000)) // +0.99 to "destination"
    .addHbarTransfer('0.0.9693516', Hbar.fromTinybars(1_000_000)) // +0.01 fee leg (same acct here, fine for spike)
    .freezeWith(client);

  await tx.signWith(publicKey, externalSigner);

  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  console.log('SPIKE RESULT: SUCCESS');
  console.log('status:', receipt.status.toString());
  console.log('tx:', resp.transactionId.toString());
  console.log('HashScan: https://hashscan.io/testnet/transaction/' + resp.transactionId.toString());
} catch (err) {
  console.log('SPIKE RESULT: FAILED');
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  client.close();
}
