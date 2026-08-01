import { Lock, Coins, Wallet, Link2, FileCheck2, KeyRound } from 'lucide-react';
import { ProtocolExchange } from '../../components/ProtocolExchange';
import { ConnectWalletCTA } from '../../components/ConnectWalletCTA';
import { AuthRedirect } from '../../components/AuthRedirect';
import { SectionGlow } from '../../components/SectionGlow';
import { BTN_GHOST } from '../../lib/ui';

const FEATURES = [
  {
    icon: Lock,
    title: 'Instant paywalls',
    body: 'Wrap any URL you own behind a 402 challenge in seconds — no code changes on your origin server.',
  },
  {
    icon: Coins,
    title: 'Multi-asset pricing',
    body: 'Price each endpoint in HBAR, USDC, or both. Consumers pay with whichever asset they hold.',
  },
  {
    icon: KeyRound,
    title: 'Embedded wallets',
    body: 'Sign in and get a Hedera account provisioned instantly — no browser extension, no seed phrase.',
  },
  {
    icon: FileCheck2,
    title: 'Tamper-proof receipts',
    body: 'Every paid request is logged to a public Hedera Consensus Service topic, verifiable on HashScan.',
  },
];

const STEPS = [
  {
    icon: Wallet,
    title: 'Connect your wallet',
    body: 'Sign in and an embedded Hedera account is provisioned for you automatically — no extension, no seed phrase to juggle.',
  },
  {
    icon: Link2,
    title: 'Paste a URL, set a price',
    body: 'Point at any endpoint you own, price it in HBAR or USDC, and the gateway wraps it behind an x402 paywall in seconds.',
  },
  {
    icon: Coins,
    title: 'Share the link, get paid',
    body: 'Agents and humans hit your link, pay the 402 challenge, and funds land in your account with every access logged to HCS.',
  },
];

export default function Home() {
  return (
    <div className="space-y-40">
      <AuthRedirect to="/dashboard" />

      <section className="relative -mt-28 flex min-h-[85vh] items-center pt-28 pb-16">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]">
          <div
            className="absolute -top-24 left-[8%] h-[26rem] w-[26rem] rounded-full blur-[130px]"
            style={{ background: 'rgba(244,211,94,0.4)' }}
          />
          <div
            className="absolute -top-16 right-[8%] h-[26rem] w-[26rem] rounded-full blur-[130px]"
            style={{ background: 'rgba(91,141,239,0.38)' }}
          />
          <div
            className="absolute top-0 left-1/2 h-[24rem] w-[30rem] -translate-x-1/2 rounded-full blur-[140px]"
            style={{ background: 'rgba(20,33,61,0.14)' }}
          />
        </div>

        <div className="relative mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <h1 className="font-display text-5xl font-bold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            Monetize Any API in Seconds.
          </h1>

          <p className="mt-6 max-w-lg font-sans text-lg leading-relaxed text-dim">
            Paste an endpoint, choose a price, and your API becomes pay-per-call.
            Clients receive a 402 payment challenge, pay with HBAR or USDC over
            x402, and the gateway securely proxies the response while recording
            every settlement on Hedera Consensus Service.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <ConnectWalletCTA variant="solid" />
            <a href="#how-it-works" className={BTN_GHOST}>
              See how it works
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-4xl scroll-mt-28 space-y-12">
        <SectionGlow side="right" color="yellow" />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-1.5 font-sans text-xs text-dim">
            features
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-midnight">
            Everything you need to monetize a URL
          </h2>
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-3 rounded-xl border border-line p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper">
                <Icon className="h-5 w-5 text-ink" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h3>
              <p className="font-sans text-base leading-relaxed text-dim">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="relative scroll-mt-28 space-y-12">
        <SectionGlow side="left" color="blue" />

        <div className="flex flex-col items-center gap-2 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-1.5 font-sans text-xs text-dim">
            how it works
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-midnight">
            The steps to get your paid URL
          </h2>
        </div>

        <div className="grid gap-10 sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="space-y-3 rounded-xl border border-line p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper">
                <Icon className="h-5 w-5 text-ink" strokeWidth={1.75} />
              </div>
              <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{title}</h3>
              <p className="font-sans text-base leading-relaxed text-dim">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative grid gap-10 overflow-hidden rounded-2xl border border-line p-10 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <SectionGlow side="right" color="midnight" />

        <div className="space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-1.5 font-sans text-xs text-dim">
            live example
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-midnight">
            A full 402 handshake, end to end
          </h2>
          <p className="max-w-md font-sans text-base leading-relaxed text-dim">
            Every unpaid request gets a signed 402 challenge. The client pays over
            x402, the facilitator settles on Hedera, and the response streams back
            with a receipt and an HCS sequence number you can verify on HashScan.
          </p>
          <div className="pt-2">
            <ConnectWalletCTA variant="solid" />
          </div>
        </div>

        <ProtocolExchange />
      </section>
    </div>
  );
}
