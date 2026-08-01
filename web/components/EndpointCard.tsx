'use client';

import { useState } from 'react';

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
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(protectedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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

      <div
        onClick={handleCopy}
        title="Click to copy protected URL"
        className="group mt-2 flex cursor-pointer items-center justify-between gap-2 rounded-md border border-line bg-paper px-3 py-2 text-xs text-ink hover:bg-raised transition-colors"
      >
        <span className="break-all">{protectedUrl}</span>
        <span className="shrink-0 font-sans text-xs text-dim group-hover:text-ink transition-colors">
          {copied ? 'copied ✓' : ' copy'}
        </span>
      </div>

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
