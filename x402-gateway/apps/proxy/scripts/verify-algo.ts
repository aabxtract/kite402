import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { sha256 } from '@noble/hashes/sha2.js';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);
const pubKey = sdkKey.publicKey;
const msg = new TextEncoder().encode('hello hedera spike');

const sdkSig = sdkKey.sign(msg);
console.log('sdk verifies sdkSig:', pubKey.verify(msg, sdkSig));

const keyBytes = Uint8Array.from(Buffer.from(keyHex, 'hex'));

// Test keccak vs sha256 with verify
const keccakSig = secp256k1.sign(keccak_256(msg), keyBytes);
const keccakSigBytes = Uint8Array.from(keccakSig);
console.log('sdk verifies keccakSig:', pubKey.verify(msg, keccakSigBytes));

const sha256Sig = secp256k1.sign(sha256(msg), keyBytes);
const sha256SigBytes = Uint8Array.from(sha256Sig);
console.log('sdk verifies sha256Sig:', pubKey.verify(msg, sha256SigBytes));

console.log('sdkKey sign method string:', sdkKey.sign.toString());
