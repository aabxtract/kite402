'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Spinner } from './Spinner';

/**
 * Gates a page behind a Privy session, sending signed-out visitors to the
 * landing page. Renders a spinner rather than the page while Privy resolves —
 * `authenticated` is false before `ready`, so rendering children early would
 * flash signed-out UI (and fire its data fetches) at a user who is logged in.
 */
export function RequireAuth({ children, to = '/' }: { children: ReactNode; to?: string }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && !authenticated) router.replace(to);
  }, [ready, authenticated, router, to]);

  if (!ready || !authenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="h-6 w-6 text-dim" />
      </div>
    );
  }

  return <>{children}</>;
}
