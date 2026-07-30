import { CreateEndpointForm } from '../components/CreateEndpointForm';
import { ProtocolExchange } from '../components/ProtocolExchange';

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="relative grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -left-8 select-none font-display text-[11rem] font-extrabold leading-none text-paper/[0.04] lg:text-[16rem]"
        >
          402
        </div>

        <div className="relative space-y-5">
          <p className="font-mono text-xs text-amber">HTTP 402 · finally in service</p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Any URL.
            <br />
            Now payable.
          </h1>
          <p className="max-w-md text-dim">
            Paste a URL and set a price. Consumers hit your endpoint, get a 402
            challenge, pay in HBAR or USDC over x402, and the gateway proxies the
            response — with every settlement logged to a public Hedera Consensus
            Service topic.
          </p>
          <ul className="space-y-1.5 font-mono text-xs text-dim">
            <li>
              <span className="text-mint">▸</span> upstream URLs stored AES-256-GCM encrypted
            </li>
            <li>
              <span className="text-mint">▸</span> signed JWT receipt on every paid request
            </li>
            <li>
              <span className="text-mint">▸</span> tamper-proof audit trail, verifiable on HashScan
            </li>
          </ul>
        </div>

        <ProtocolExchange />
      </section>

      <section id="create" className="space-y-6">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Create a paid endpoint
          </h2>
          <span className="font-mono text-xs text-dim">~10 seconds</span>
        </div>
        <CreateEndpointForm />
      </section>
    </div>
  );
}
