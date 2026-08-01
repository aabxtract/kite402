import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * These bind to a runtime-provided fetch/WebSocket at import time. Bundling
   * them into the server chunk hands them an undefined global, which throws
   * "Cannot read properties of undefined (reading 'fetch')" at module scope and
   * turns every API route into a 500. Loading them as real node_modules at
   * runtime keeps their own environment detection intact.
   */
  serverExternalPackages: [
    '@neondatabase/serverless',
    '@hashgraph/sdk',
    '@hashgraph/proto',
    '@privy-io/server-auth',
  ],
};

export default nextConfig;
