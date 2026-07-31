import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

interface ReceiptPayload {
  jti: string;
  endpointId: string;
  txId: string;
  token: string;
  amount: string;
  expiresIn: number;
}

// Note: HS256 receipt is proxy-internal — the proxy issues it and returns it in response
// headers as proof of payment. Upstreams cannot independently verify it without the JWT_SECRET.
// If upstream verification is needed, switch to RS256/EdDSA with a published JWK.

export async function issueReceipt(payload: ReceiptPayload): Promise<string> {
  return new SignJWT({
    endpointId: payload.endpointId,
    txId: payload.txId,
    token: payload.token,
    amount: payload.amount,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(payload.jti)
    .setIssuedAt()
    .setExpirationTime(`${payload.expiresIn}s`)
    .sign(secret);
}
