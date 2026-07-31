'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

/** Sends a signed-in visitor from the landing page straight to the dashboard. */
export function AuthRedirect({ to }: { to: string }) {
  const { ready, authenticated } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.replace(to);
  }, [ready, authenticated, router, to]);

  return null;
}
