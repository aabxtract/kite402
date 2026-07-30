// Find the exact hash function the Hedera SDK uses for ECDSA signing
// by walking the internal prototype chain and dumping source code
import { PrivateKey } from '@hashgraph/sdk';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);

// Walk internal layers
const innerKey = (sdkKey as any)._key; // PrivateKeyCrypto 
console.log('=== Layer 1: sdkKey._key ===');
console.log('type:', innerKey.constructor?.name);
console.log('sign:', innerKey.sign.toString().slice(0, 500));

const ecdsaKey = innerKey._key;
console.log('\n=== Layer 2: sdkKey._key._key ===');
console.log('type:', ecdsaKey.constructor?.name);
console.log('sign:', ecdsaKey.sign.toString().slice(0, 500));

// Check if there's a deeper layer
if (ecdsaKey._key) {
  console.log('\n=== Layer 3: sdkKey._key._key._key ===');
  console.log('type:', ecdsaKey._key.constructor?.name);
  console.log('sign:', ecdsaKey._key.sign?.toString().slice(0, 500));
}

// Also dump prototype chain for ecdsaKey
const proto = Object.getPrototypeOf(ecdsaKey);
console.log('\n=== Prototype methods ===');
console.log(Object.getOwnPropertyNames(proto));

// Look for hash usage by dumping sign function more fully
console.log('\n=== Full sign chain ===');
// The sign method likely calls another function - let's trace what it does
const msg = new TextEncoder().encode('test');
const sig = sdkKey.sign(msg);
console.log('sig length:', sig.length);

// Check if the module path gives us clues
console.log('\n=== Module resolution ===');
try {
  // Try to find where PrivateKeyCrypto comes from
  const mod = await import('@hiero-ledger/cryptography');
  console.log('crypto module keys:', Object.keys(mod).slice(0, 20));
} catch(e: any) {
  console.log('import error:', e.message);
}

// Directly try the SDK's approach: maybe it uses SHA-384 then signs the full 48-byte hash
// secp256k1 lowS normalizes and uses SHA-256 by default in noble
// But the SDK might be using its own crypto path
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const keyBytes = Uint8Array.from(Buffer.from(keyHex, 'hex'));

// What if the SDK passes the message to sign() with prehash option?
// noble's secp256k1.sign(msg, key, {prehash: true}) will internally sha256 the msg
const prehashSig = secp256k1.sign(msg, keyBytes, { prehash: true });
console.log('\nprehash=true sig match:', Buffer.from(Uint8Array.from(prehashSig)).toString('hex') === Buffer.from(sig).toString('hex'));

// What about lowS normalization?
const sdkSigHex = Buffer.from(sig).toString('hex');
const prehashSigHex = Buffer.from(Uint8Array.from(prehashSig)).toString('hex');
console.log('sdk sig hex:', sdkSigHex);
console.log('prehash hex:', prehashSigHex);
