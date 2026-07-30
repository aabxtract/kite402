import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { sha256, sha384 } from '@noble/hashes/sha2.js';

const consumerKeyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(consumerKeyHex);
const publicKey = sdkKey.publicKey;
const keyBytes = Uint8Array.from(Buffer.from(consumerKeyHex, 'hex'));

const dummyMsg = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// 1. What does sdkKey.sign(dummyMsg) return?
const sdkSig = sdkKey.sign(dummyMsg);
console.log('publicKey.verify(dummyMsg, sdkSig):', publicKey.verify(dummyMsg, sdkSig));

// Helper to convert hex string to byte array
function hexToBytes(hex: string): Uint8Array {
  hex = hex.replace(/^0x/, '');
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Re-create the SDK's exact keccak string implementation from keccak.js
function sdkKeccak256(msgBytes: Uint8Array): Uint8Array {
  const hexStr = bytesToHex(msgBytes);
  // keccak.js in SDK: if str.slice(0, 2) === "0x", msg = [] parse pairs ...
  // Wait! In keccak.js:
  //   if (str.slice(0, 2) === "0x") {
  //       msg = [];
  //       for (var i = 2, l = str.length; i < l; i += 2)
  //           msg.push(parseInt(str.slice(i, i + 2), 16));
  //   } else { msg = str; }
  // Notice! In ecdsa.js: `const msg = hex.encode(message);` -> produces hex string without 0x!
  // `const data = hex.decode(keccak256(`0x${msg}`));`
  // `0x${msg}` STARTS WITH 0x! So keccak256 parses it back to byte array!
}

// Let's test different candidate hashes with secp256k1.sign(candidateHash, keyBytes)
const candidateHashes: Record<string, Uint8Array> = {
  'keccak_256(msg)': keccak_256(dummyMsg),
  'sha256(msg)': sha256(dummyMsg),
  'sha384(msg).subarray(0,32)': sha384(dummyMsg).subarray(0, 32),
  'keccak_256(keccak_256(msg))': keccak_256(keccak_256(dummyMsg)),
  'sha256(sha256(msg))': sha256(sha256(dummyMsg)),
  'keccak_256(sha256(msg))': keccak_256(sha256(dummyMsg)),
  'sha256(keccak_256(msg))': sha256(keccak_256(dummyMsg)),
};

console.log('\n--- Testing Candidate Hashes with secp256k1.sign ---');
for (const [name, hash] of Object.entries(candidateHashes)) {
  const sig = secp256k1.sign(hash, keyBytes);
  const sigBytes = Uint8Array.from(sig);
  const verifies = publicKey.verify(dummyMsg, sigBytes);
  console.log(`${name.padEnd(30)} -> publicKey.verify: ${verifies}`);
}

// Let's also check: what if dummyMsg is ALREADY hashed before passed to sign()?
console.log('\n--- Testing if dummyMsg was already hashed ---');
for (const [name, hash] of Object.entries(candidateHashes)) {
  const sig = secp256k1.sign(dummyMsg.length === 32 ? dummyMsg : sha256(dummyMsg), keyBytes);
  // Wait, if dummyMsg is hashed with `hash` directly as 32-byte keydata:
  try {
    const directSig = secp256k1.sign(hash, keyBytes);
    const verifiesDirect = publicKey.verify(hash, Uint8Array.from(directSig));
    console.log(`publicKey.verify(${name}, sigOfHash) -> ${verifiesDirect}`);
  } catch (e) {}
}
