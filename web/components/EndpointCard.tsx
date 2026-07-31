'use client';

interface EndpointCardProps {
  slug: string;
  protectedUrl: string;
  priceHbar?: string | null;
  priceUsdc?: string | null;
  maxRequestsPerDay: number | null;
  createdAt: string | null;
  isActive: boolean | null;
  requestCount?: number | string;
  clickCount?: number | string;
}

function formatPrice(units: string, factor: number): string {
  return (Number(units) / factor).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export function EndpointCard({
  slug,
  protectedUrl,
  priceHbar,
  priceUsdc,
  maxRequestsPerDay,
  createdAt,
  isActive,
  requestCount,
  clickCount,
}: EndpointCardProps) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 font-mono text-sm">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-dim">/{slug}</span>
        <span
          className={`text-xs font-semibold ${isActive ? 'text-mint' : 'text-alert'}`}
        >
          {isActive ? '● live' : '● inactive'}
        </span>
      </div>

      <p className="mt-2 break-all rounded-md border border-line bg-ink px-3 py-2 text-xs text-paper/90">
        {protectedUrl}
      </p>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-dim">
        {priceHbar && <span className="text-mint">{formatPrice(priceHbar, 100_000_000)} HBAR</span>}
        {priceUsdc && <span className="text-mint">{formatPrice(priceUsdc, 1_000_000)} USDC</span>}
        <span>{maxRequestsPerDay ?? 1000} req/day cap</span>
        {requestCount !== undefined && <span>{Number(requestCount)} sales</span>}
        {clickCount !== undefined && <span>{Number(clickCount)} clicks</span>}
        {createdAt && <span>created {new Date(createdAt).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
