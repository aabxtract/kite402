import { PrivateKey } from '@hashgraph/sdk';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);
const ecdsaKey = (sdkKey as any)._key._key;

console.log('ecdsaKey prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ecdsaKey)));
console.log('ecdsaKey sign source:', ecdsaKey.sign.toString());
