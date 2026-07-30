'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';

const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || 'http://localhost:3001';
const REGISTER_MESSAGE = 'Register Hedera Account';

export interface UserRecord {
  id: string;
  privyId: string;
  email?: string | null;
  hederaAccountId?: string | null;
  hederaPublicKey?: string | null;
}

/**
 * Provisions (or loads) the signed-in user's embedded Hedera account. Shared by
 * any page that needs the linked account — provisioning requires one wallet
 * signature and must only happen once, the first time any such page mounts.
 */
export function useHederaAccount() {
  const { user, authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null);
  const [balanceHbar, setBalanceHbar] = useState<string>('0');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const getEmbeddedProvider = useCallback(async () => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) throw new Error('No embedded wallet found');
    return embeddedWallet.getEthereumProvider();
  }, [wallets]);

  const getSigner = useCallback(async () => {
    const provider = await getEmbeddedProvider();
    const ethersProvider = new ethers.BrowserProvider(provider as any);
    return ethersProvider.getSigner();
  }, [getEmbeddedProvider]);

  /**
   * Genuine raw ECDSA signature over `hash` (no EIP-191 prefix/re-hash) — required
   * for anything that gets submitted as a real Hedera transaction, since Hedera's
   * ECDSA verification checks the signature against `keccak256(bodyBytes)` directly.
   * `ethers.Signer.signMessage()` only exposes `personal_sign`, which prefixes and
   * re-hashes, producing a signature that's invalid for actual on-chain submission.
   */
  const signRawHash = useCallback(
    async (hash: `0x${string}`): Promise<`0x${string}`> => {
      const provider = await getEmbeddedProvider();
      const { data } = await (provider as any).request({
        method: 'secp256k1_sign',
        params: [hash],
      });
      return data;
    },
    [getEmbeddedProvider],
  );

  const syncUser = useCallback(async () => {
    if (!authenticated || !user) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      const token = await getAccessToken();
      const authHeaders = { Authorization: `Bearer ${token}` };

      // Already provisioned? Skip the signature prompt entirely.
      const meRes = await fetch(`${PROXY_URL}/api/user/me`, { headers: authHeaders });
      if (meRes.ok) {
        const meData = await meRes.json();
        setUserRecord(meData.user);
        setBalanceHbar(meData.balanceHbar || '0');
        return;
      }
      if (meRes.status !== 404) {
        const data = await meRes.json().catch(() => ({}));
        setSyncError(data.error || 'Could not load account');
        return;
      }

      // Not provisioned yet: recover the secp256k1 public key from a signature,
      // then provision the embedded Hedera account.
      const signer = await getSigner();
      const signature = await signer.signMessage(REGISTER_MESSAGE);
      const msgHash = ethers.hashMessage(REGISTER_MESSAGE);
      const publicKeyHex = ethers.SigningKey.recoverPublicKey(msgHash, signature);

      const res = await fetch(`${PROXY_URL}/api/user/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ publicKeyHex, email: user.email?.address }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error || 'Sync failed');
        return;
      }
      setUserRecord(data.user);

      if (data.user?.hederaAccountId) {
        const meRes2 = await fetch(`${PROXY_URL}/api/user/me`, { headers: authHeaders });
        const meData2 = await meRes2.json();
        if (meData2.balanceHbar) setBalanceHbar(meData2.balanceHbar);
      }
    } catch (e: any) {
      setSyncError(e?.message || 'Could not connect to gateway. Is it running?');
    } finally {
      setIsSyncing(false);
    }
  }, [authenticated, user, getAccessToken, getSigner]);

  useEffect(() => {
    if (authenticated && user && wallets.length > 0) {
      syncUser();
    }
  }, [authenticated, user?.id, wallets.length, syncUser]);

  return { userRecord, balanceHbar, isSyncing, syncError, syncUser, getSigner, signRawHash, getAccessToken };
}
