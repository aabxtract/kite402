import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactHederaScheme } from '@x402/hedera/exact/client';
import { createClientHederaSigner, HEDERA_TESTNET_CAIP2, PrivateKey } from '@x402/hedera';

const PROXY = process.env.PROXY_BASE_URL ?? 'http://localhost:3001';
const slug = process.argv[2];
if (!slug) {
  console.error('Usage: bun run scripts/test-payment.ts <slug>');
  process.exit(1);
}

const signer = createClientHederaSigner(
  process.env.CONSUMER_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.CONSUMER_PRIVATE_KEY!)
);

const client = new x402Client().register(HEDERA_TESTNET_CAIP2, new ExactHederaScheme(signer));
const httpClient = new x402HTTPClient(client);

const url = `${PROXY}/p/${slug}`;

console.log(`1. GET ${url} (no payment)`);
const first = await fetch(url);
console.log(`   status: ${first.status}`);
if (first.status !== 402) {
  console.error('   Expected 402. Body:', await first.text());
  process.exit(1);
}

const paymentRequired = httpClient.getPaymentRequiredResponse(
  (name) => first.headers.get(name),
  await first.clone().json().catch(() => undefined)
);
console.log(`2. Challenge parsed: ${paymentRequired.accepts.length} accept(s)`);
for (const a of paymentRequired.accepts) {
  console.log(`   - ${a.network} asset=${'asset' in a ? (a as { asset?: string }).asset : '?'} amount=${'amount' in a ? (a as { amount?: string }).amount : '?'}`);
}

console.log('3. Creating + signing payment payload...');
const payload = await client.createPaymentPayload(paymentRequired);
const headers = httpClient.encodePaymentSignatureHeader(payload);
console.log(`   headers: ${Object.keys(headers).join(', ')}`);

console.log('4. Retrying with payment...');
const paid = await fetch(url, { headers });
console.log(`   status: ${paid.status}`);
console.log(`   X-X402-Receipt: ${paid.headers.get('x-x402-receipt')?.slice(0, 40)}...`);
console.log(`   X-HCS-Sequence: ${paid.headers.get('x-hcs-sequence')}`);
console.log(`   X-Payment-Response: ${paid.headers.get('x-payment-response') ?? paid.headers.get('payment-response') ?? '(none)'}`);
const body = await paid.text();
console.log(`5. Upstream body (first 300 chars):\n${body.slice(0, 300)}`);
process.exit(paid.status === 200 ? 0 : 1);
