import { PrivateKey } from '@hashgraph/sdk';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);
const inner = (sdkKey as any)._key;
const ecdsaKey = inner._key;

// Let's import or inspect the ecdsa object/module directly
console.log('ecdsa object or function in ecdsaKey module:');
// Let's check keys on inner or require/import ecdsa
console.log(ecdsaKey);
