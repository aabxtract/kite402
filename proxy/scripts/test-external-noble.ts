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
const sdkKey = PrivateKey.fromStringECDSA(consumerKeyHex);
const publicKey = sdkKey.publicKey;

// Import the SDK's internal cryptography ecdsa module directly to compare!
const ecdsaMod = (sdkKey as any)._key._key;

const client = Client.forTestnet();

// Test 1: Using SDK's internal keccak256 prep hashing
function hederaEcdsaHash(message: Uint8Array): Uint8Array {
  // Let's test if keccak_256(message) or something else is what Hedera expects
  return keccak_256(message);
}

const tx = new TransferTransaction()
  .setTransactionId(TransactionId.generate(AccountId.fromString(consumerId)))
  .addHbarTransfer(consumerId, Hbar.fromTinybars(-100_000_000))
  .addHbarTransfer(process.env.HEDERA_ACCOUNT_ID!, Hbar.fromTinybars(99_000_000))
  .addHbarTransfer('0.0.9693516', Hbar.fromTinybars(1_000_000))
  .freezeWith(client);

const keyBytes = Uint8Array.from(Buffer.from(consumerKeyHex, 'hex'));

await tx.signWith(publicKey, async (message: Uint8Array) => {
  // Compare sdkKey.sign(message) vs noble sign
  const sdkSig = sdkKey.sign(message);
  
  // Try noble signing keccak_256(message)
  const hash = keccak_256(message);
  const nobleSig = secp256k1.sign(hash, keyBytes);

  console.log('sdkSig hex:   ', Buffer.from(sdkSig).toString('hex'));
  console.log('nobleSig hex: ', Buffer.from(nobleSig).toString('hex'));
  
  // Test if publicKey.verify accepts nobleSig!
  const sdkVerifyNoble = publicKey.verify(message, Uint8Array.from(nobleSig));
  console.log('publicKey.verify(message, nobleSig):', sdkVerifyNoble);

  return Uint8Array.from(nobleSig);
});

try {
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  console.log('SPIKE RESULT: SUCCESS! Status:', receipt.status.toString());
} catch (err: any) {
  console.error('SPIKE RESULT: FAILED:', err.message);
} finally {
  client.close();
}
