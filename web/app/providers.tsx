'use client';

import { PrivyProvider } from '@privy-io/react-auth';

// Inlined at build time by Next, so a missing value is a build/config problem,
// not a runtime one. Privy rejects malformed ids with an opaque error, so fail
// here with something that actually names the missing variable.
function requirePrivyAppId(): string {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error(
      'NEXT_PUBLIC_PRIVY_APP_ID is not set. Add it to web/.env.local for local ' +
        "development, and to the project's environment variables in Vercel.",
    );
  }
  return appId;
}

const PRIVY_APP_ID = requirePrivyAppId();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#14213d',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
