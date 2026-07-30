import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { keccak_256 } from '@noble/hashes/sha3.js';

const consumerKeyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(consumerKeyHex);
const publicKey = sdkKey.publicKey;
const keyBytes = Uint8Array.from(Buffer.from(consumerKeyHex, 'hex'));

const dummyMsg = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

// Let's call the actual ecdsa.sign module from the SDK!
const ecdsaMod = (sdkKey as any)._key._key;

// Let's trace how ecdsaMod computes hash!
// In ecdsa.js line 78-79:
// const msg = hex.encode(message);
// const data = hex.decode(keccak256(`0x${msg}`));

// Let's get the exact function:
const ecdsaPrimitive = require('c:/Users/anuoluwapo/OneDrive/Desktop/kite402/x402-gateway/node_modules/.bun/@hiero-ledger+cryptography@1.19.0+09acfce4af601cdb/node_modules/@hiero-ledger/cryptography/lib/primitive/ecdsa.cjs');
const keccakPrimitive = require('c:/Users/anuoluwapo/OneDrive/Desktop/kite402/x402-gateway/node_modules/.bun/@hiero-ledger+cryptography@1.19.0+09acfce4af601cdb/node_modules/@hiero-ledger/cryptography/lib/primitive/keccak.cjs');
const hexPrimitive = require('c:/Users/anuoluwapo/OneDrive/Desktop/kite402/x402-gateway/node_modules/.bun/@hiero-ledger+cryptography@1.19.0+09acfce4af601cdb/node_modules/@hiero-ledger/cryptography/lib/encoding/hex.cjs');

console.log('ecdsaPrimitive exports:', Object.keys(ecdsaPrimitive));

// Let's run ecdsaPrimitive's exact hash logic on dummyMsg:
const msgHex = hexPrimitive.encode(dummyMsg);
const keccakHex = keccakPrimitive.keccak256(`0x${msgHex}`);
const sdkHashBytes = hexPrimitive.decode(keccakHex);

console.log('sdkHashBytes hex:', Buffer.from(sdkHashBytes).toString('hex'));
console.log('noble keccak_256: ', Buffer.from(keccak_256(dummyMsg)).toString('hex'));
console.log('SDK hash === noble keccak_256:', Buffer.from(sdkHashBytes).toString('hex') === Buffer.from(keccak_256(dummyMsg)).toString('hex'));

// Now let's sign sdkHashBytes using secp256k1.sign from @noble/curves!
const nobleSigOnSdkHash = secp256k1.sign(sdkHashBytes, keyBytes);
console.log('publicKey.verify(dummyMsg, nobleSigOnSdkHash):', publicKey.verify(dummyMsg, Uint8Array.from(nobleSigOnSdkHash)));

// What does ecdsaPrimitive.sign return?
const ecdsaPrimSig = ecdsaPrimitive.sign(keyBytes, dummyMsg);
console.log('publicKey.verify(dummyMsg, ecdsaPrimSig):', publicKey.verify(dummyMsg, ecdsaPrimSig));
