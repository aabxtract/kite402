import { PrivateKey } from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { sha256, sha384 } from '@noble/hashes/sha2.js';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);
const msg = new TextEncoder().encode('hello hedera spike');

const sdkSig = sdkKey.sign(msg);
console.log('sdk sig len:', sdkSig.length, 'hex:', Buffer.from(sdkSig).toString('hex'));

const keyBytes = Uint8Array.from(Buffer.from(keyHex, 'hex'));
const hashes = [
  ['keccak256', keccak_256(msg)],
  ['sha256', sha256(msg)],
  ['sha384', sha384(msg)],
  ['sha384-first32', sha384(msg).subarray(0, 32)],
  ['raw', msg],
];

for (const [name, hash] of hashes as [string, Uint8Array][]) {
  try {
    const sig = secp256k1.sign(hash.length === 32 ? hash : sha256(hash), keyBytes);
    console.log(name, 'match:', Buffer.from(sig).toString('hex') === Buffer.from(sdkSig).toString('hex'));
  } catch (e: any) {
    console.log(name, 'error:', e.message);
  }
}
