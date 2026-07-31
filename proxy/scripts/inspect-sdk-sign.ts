import { PrivateKey } from '@hashgraph/sdk';

const keyHex = process.env.CONSUMER_PRIVATE_KEY!.replace(/^0x/, '');
const sdkKey = PrivateKey.fromStringECDSA(keyHex);

console.log('sdkKey constructor:', sdkKey.constructor.name);
console.log('sdkKey._key constructor:', (sdkKey as any)._key?.constructor?.name);

const inner = (sdkKey as any)._key;
console.log('inner sign code:\n', inner.sign.toString());

const ecdsaKey = inner._key;
if (ecdsaKey) {
  console.log('ecdsaKey constructor:', ecdsaKey.constructor.name);
  console.log('ecdsaKey sign code:\n', ecdsaKey.sign ? ecdsaKey.sign.toString() : 'no sign');
}
