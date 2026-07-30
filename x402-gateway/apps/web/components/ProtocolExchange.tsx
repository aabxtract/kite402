export function ProtocolExchange() {
  return (
    <div
      aria-label="Example x402 payment exchange"
      className="rounded-lg border border-line bg-surface font-mono text-[13px] leading-relaxed shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs text-dim">
        <span className="inline-block h-2 w-2 rounded-full bg-amber" />
        <span>x402 session — hedera:testnet</span>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="text-dim">
            <span className="text-paper">GET</span> /p/wx7Kd91k2A
          </p>
          <p className="mt-1 text-amber font-bold">402 Payment Required</p>
          <p className="text-dim">accepts: 0.1 HBAR · 0.001 USDC → 0.0.9693516</p>
        </div>

        <div className="border-l-2 border-line pl-3 text-dim">
          <p>PAYMENT-SIGNATURE: eyJ4NDAyVmVyc2lvbiI6Mi4uLg</p>
          <p className="text-paper/60">payer signs · facilitator settles on-chain</p>
        </div>

        <div>
          <p className="text-dim">
            <span className="text-paper">GET</span> /p/wx7Kd91k2A{' '}
            <span className="text-dim">(retry)</span>
          </p>
          <p className="mt-1 text-mint font-bold">200 OK</p>
          <p className="text-dim">
            X-HCS-Sequence: 4 · X-X402-Receipt: eyJhbGciOi…
          </p>
        </div>
      </div>
    </div>
  );
}
