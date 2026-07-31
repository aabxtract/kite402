import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import { secp256k1 } from '@noble/curves/secp256k1.js';

const k = PrivateKey.generateECDSA();
const want = k.publicKey.toStringRaw();
const unc = secp256k1.getPublicKey(k.toBytesRaw(), false);
console.log('Point?', typeof (secp256k1 as any).Point, 'ProjectivePoint?', typeof (secp256k1 as any).ProjectivePoint);
const P: any = (secp256k1 as any).Point ?? (secp256k1 as any).ProjectivePoint;
const pt = P.fromBytes ? P.fromBytes(unc) : P.fromHex(unc);
const comp = pt.toBytes ? pt.toBytes(true) : pt.toRawBytes(true);
const hex = Buffer.from(comp).toString('hex');
console.log('compressed:', hex, 'matches:', hex === want);
console.log('sdk parses:', PublicKey.fromStringECDSA(hex).toStringRaw() === want);
