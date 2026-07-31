'use client';

import { useCallback, useRef, useState } from 'react';
import {
  DAppConnector,
  HederaChainId,
  HederaJsonRpcMethod,
  HederaSessionEvent,
  type DAppSigner,
} from '@hashgraph/hedera-wallet-connect';
import { LedgerId } from '@hashgraph/sdk';

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const IS_MAINNET = process.env.NEXT_PUBLIC_HEDERA_NETWORK === 'mainnet';
const NETWORK = IS_MAINNET ? LedgerId.MAINNET : LedgerId.TESTNET;
const CHAIN = IS_MAINNET ? HederaChainId.Mainnet : HederaChainId.Testnet;

// A WalletConnect client must be a single instance across the app — re-running
// init() on every hook mount would create duplicate sessions/pairings.
let connectorPromise: Promise<DAppConnector> | null = null;

function getConnector(): Promise<DAppConnector> {
  if (!PROJECT_ID) {
    throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured. Get a free one at https://cloud.reown.com');
  }
  connectorPromise ??= (async () => {
    const connector = new DAppConnector(
      {
        name: 'kite402',
        description: 'Pay for x402-protected endpoints with a Hedera wallet',
        url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000',
        icons: [],
      },
      NETWORK,
      PROJECT_ID,
      Object.values(HederaJsonRpcMethod),
      [HederaSessionEvent.ChainChanged, HederaSessionEvent.AccountsChanged],
      [CHAIN],
    );
    await connector.init({ logger: 'error' });
    return connector;
  })();
  return connectorPromise;
}

export function useHederaWalletConnect() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signerRef = useRef<DAppSigner | null>(null);

  const connect = useCallback(async (): Promise<{ accountId: string; signer: DAppSigner }> => {
    setConnecting(true);
    setError(null);
    try {
      const connector = await getConnector();
      await connector.openModal();
      const signer = connector.signers[connector.signers.length - 1];
      if (!signer) throw new Error('Wallet did not return a signer');
      signerRef.current = signer;
      const id = signer.getAccountId().toString();
      setAccountId(id);
      return { accountId: id, signer };
    } catch (e: any) {
      const msg = e?.message || 'Failed to connect wallet';
      setError(msg);
      throw new Error(msg);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const connector = await getConnector();
    await connector.disconnectAll().catch(() => {});
    signerRef.current = null;
    setAccountId(null);
  }, []);

  return { accountId, connecting, error, connect, disconnect };
}
