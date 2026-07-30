// Replicate the EXACT signing logic from the Hedera SDK's ecdsa.js
// to prove we can match it externally
import { PrivateKey } from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);
const msg = new TextEncoder().encode('hello hedera spike');

// SDK produces this:
const sdkSig = sdkKey.sign(msg);
console.log('SDK sig:', Buffer.from(sdkSig).toString('hex'));

// Now replicate the SDK's ecdsa.sign() logic exactly:
//   const msg = hex.encode(message);
//   const data = hex.decode(keccak256(`0x${msg}`));
//   const signature = secp256k1.sign(data, keydata);
//   return signature.toCompactRawBytes();
//
// The SDK's keccak256 takes a "0x..." hex string, parses the hex bytes,
// and runs keccak256 on those bytes. Net effect = keccak256(rawBytes).
// Noble's keccak_256 does the same on Uint8Array input.

const keyBytes = Uint8Array.from(Buffer.from(keyHex, 'hex'));
const hash = keccak_256(msg); // should be identical to SDK's roundtrip

console.log('hash:', Buffer.from(hash).toString('hex'));

// noble v2: secp256k1.sign() returns Uint8Array directly (64 bytes)  
// but the SDK uses @noble/curves which has .sign() returning a Signature object
// Let's check what noble v2 actually returns:
const sigResult = secp256k1.sign(hash, keyBytes);
console.log('sigResult type:', typeof sigResult);
console.log('sigResult constructor:', sigResult?.constructor?.name);

// If it's a Signature object, use toCompactRawBytes()
if (sigResult.toCompactRawBytes) {
  const compactBytes = sigResult.toCompactRawBytes();
  console.log('compact:', Buffer.from(compactBytes).toString('hex'));
  console.log('MATCH toCompactRawBytes:', Buffer.from(compactBytes).toString('hex') === Buffer.from(sdkSig).toString('hex'));
}

// Also try Uint8Array.from in case it's different
const asU8 = Uint8Array.from(sigResult);
console.log('asU8:', Buffer.from(asU8).toString('hex'));
console.log('MATCH asU8:', Buffer.from(asU8).toString('hex') === Buffer.from(sdkSig).toString('hex'));

// Also check: does lowS matter?
const sigResultLowS = secp256k1.sign(hash, keyBytes, { lowS: true });
if (sigResultLowS.toCompactRawBytes) {
  const compact = sigResultLowS.toCompactRawBytes();
  console.log('MATCH lowS:', Buffer.from(compact).toString('hex') === Buffer.from(sdkSig).toString('hex'));
}
