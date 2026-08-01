import { ProtocolExchange } from '../../../components/ProtocolExchange';

const STEPS = [
  {
    title: '1. Register an endpoint',
    body: 'From the dashboard, paste the URL you want to protect and set a price in HBAR and/or USDC. You get back an agent URL and a human paywall URL.',
  },
  {
    title: '2. Unpaid requests get a 402',
    body: 'GET the agent URL without payment and the gateway responds 402 Payment Required, with the accepted assets and destination account in the body.',
  },
  {
    title: '3. Pay over x402, retry',
    body: 'Construct a payment payload with the x402 client SDK, sign it, and attach it as a PAYMENT-SIGNATURE header. Retry the request — the gateway verifies, settles on Hedera, and proxies your response.',
  },
  {
    title: '4. Verify the receipt',
    body: 'Every paid response includes an X-HCS-Sequence header. Look it up on the public HCS topic (linked in the footer) on HashScan to confirm the settlement independently.',
  },
];

export default function Docs() {
  return (
    <div className="space-y-12">
      <div className="space-y-2">
        <p className="font-sans text-sm text-dim">Docs</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          How the 402 handshake works
        </h1>
        <p className="max-w-xl text-base leading-[1.5] text-dim">
          kite402 wraps any URL you own behind the x402 payment protocol. This page
          walks through the request lifecycle end to end.
        </p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div className="space-y-6">
          {STEPS.map((step) => (
            <div key={step.title} className="space-y-1.5 rounded-xl border border-line p-5">
              <h2 className="font-display text-lg font-semibold tracking-tight">{step.title}</h2>
              <p className="text-sm leading-[1.5] text-dim">{step.body}</p>
            </div>
          ))}
        </div>

        <ProtocolExchange />
      </div>
    </div>
  );
}
