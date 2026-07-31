import {
  Client,
  TransferTransaction,
  PrivateKey,
  PublicKey,
  Hbar,
  AccountId,
  TransactionId,
} from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const consumerId = process.env.CONSUMER_ACCOUNT_ID!;
const consumerKeyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(consumerKeyHex);
const publicKey = sdkKey.publicKey;

console.log('Public Key type:', publicKey._key.constructor.name);
console.log('PublicKey.verify method:', publicKey.verify.toString());

// Let's test signWith callback arguments!
const client = Client.forTestnet();

const tx = new TransferTransaction()
  .setTransactionId(TransactionId.generate(AccountId.fromString(consumerId)))
  .addHbarTransfer(consumerId, Hbar.fromTinybars(-100_000_000))
  .addHbarTransfer(process.env.HEDERA_ACCOUNT_ID!, Hbar.fromTinybars(99_000_000))
  .addHbarTransfer('0.0.9693516', Hbar.fromTinybars(1_000_000))
  .freezeWith(client);

let receivedMessage: Uint8Array | null = null;

await tx.signWith(publicKey, async (message: Uint8Array) => {
  receivedMessage = message;
  console.log('signWith callback received message length:', message.length);
  console.log('received message hex:', Buffer.from(message).toString('hex'));

  // Let's see what sdkKey.sign(message) produces on this exact message!
  const sdkSig = sdkKey.sign(message);
  console.log('sdkKey.sign signature length:', sdkSig.length);
  console.log('sdkKey.sign signature hex:', Buffer.from(sdkSig).toString('hex'));
  
  // Let's check if publicKey.verify(message, sdkSig) returns true!
  const verSdk = publicKey.verify(message, sdkSig);
  console.log('publicKey.verify(message, sdkSig):', verSdk);

  return sdkSig;
});

console.log('Tx signed with sdkKey.sign result!');

try {
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  console.log('TX EXECUTION WITH SDK KEY SIGNATURE SUCCESS! Status:', receipt.status.toString());
} catch (err: any) {
  console.error('TX EXECUTION FAILED:', err.message);
} finally {
  client.close();
}
