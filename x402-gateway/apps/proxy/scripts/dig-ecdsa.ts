// Dig into the SDK's ECDSA module to find the actual hash function used for signing
import { PrivateKey } from '@hashgraph/sdk';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);

// Walk the internal chain
const innerKey = (sdkKey as any)._key; // EcdsaPrivateKey
const ecdsaKey = innerKey._key; // the actual ecdsa keypair wrapper

console.log('--- innerKey (EcdsaPrivateKey) ---');
console.log('sign source:', innerKey.sign.toString());

console.log('\n--- ecdsaKey (ecdsa keypair) ---');
console.log('sign source:', ecdsaKey.sign.toString());

// Try to find the ecdsa module
try {
  const ecdsaMod = innerKey.constructor;
  console.log('\n--- constructor:', ecdsaMod.name);
  console.log('static methods:', Object.getOwnPropertyNames(ecdsaMod));
} catch (e: any) {
  console.log('constructor inspect failed:', e.message);
}

// Look for the hash function in the sign path by checking if it imports sha256/keccak
// Let's look at the actual sign implementation more carefully
const signFn = ecdsaKey.sign;
console.log('\n--- ecdsaKey.sign detailed ---');
console.log(signFn.toString());

// Try finding the ecdsa module directly
try {
  // The ecdsa module should be importable
  const mod = await import('@hashgraph/sdk/src/cryptography/ecdsa.js');
  console.log('\n--- ecdsa module exports:', Object.keys(mod));
  if (mod.sign) console.log('ecdsa.sign:', mod.sign.toString());
} catch (e: any) {
  console.log('\nCannot import ecdsa module directly:', e.message);
}

// Test: does the SDK sign the raw bytes or hash them first?
// Sign same message, check if SDK's verify accepts noble sign with NO hash
import { secp256k1 } from '@noble/curves/secp256k1.js';

const msg = new TextEncoder().encode('hello hedera spike');
const keyBytes = Uint8Array.from(Buffer.from(keyHex, 'hex'));

// Try signing raw bytes (no hash at all) - secp256k1 requires 32 bytes
// Try signing with sha256 of sha256 (double hash)
import { sha256 } from '@noble/hashes/sha2.js';
const dblHash = sha256(sha256(msg));
const dblSig = secp256k1.sign(dblHash, keyBytes);
console.log('\nsdk verifies dblSha256Sig:', sdkKey.publicKey.verify(msg, Uint8Array.from(dblSig)));

// The SDK's verify function - what hash does it use?
console.log('\n--- publicKey.verify source ---');
console.log(sdkKey.publicKey.verify.toString());
