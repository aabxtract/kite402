import { AccountId, Client, Hbar, TokenId, TransactionId, TransferTransaction } from '@hashgraph/sdk';
import type { DAppSigner } from '@hashgraph/hedera-wallet-connect';
import { HBAR_ASSET_ID, HEDERA_MAINNET_CAIP2 } from '@x402/hedera';

interface PaymentRequirementsLike {
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  extra?: { feePayer?: string };
}

/**
 * Implements @x402/hedera's `ClientHederaSigner` interface, backed by a wallet
 * connected via WalletConnect (HashPack/Blade/etc.) instead of a raw private key.
 * Mirrors @x402/hedera's own reference `createClientHederaSigner` transaction
 * construction exactly (see node_modules/@x402/hedera/dist/esm/index.mjs) — the
 * transaction id account is the facilitator's fee payer, not the actual payer,
 * matching what the proxy's inspectPayload already expects.
 */
export function createHederaWalletConnectSigner(dAppSigner: DAppSigner) {
  const accountId = dAppSigner.getAccountId().toString();

  return {
    accountId,
    createPartiallySignedTransferTransaction: async (requirements: PaymentRequirementsLike): Promise<string> => {
      const feePayer = requirements.extra?.feePayer;
      if (!feePayer) throw new Error('feePayer is required in paymentRequirements.extra');

      const amount = BigInt(requirements.amount);
      if (amount <= 0n) throw new Error('amount must be greater than zero');

      const payer = AccountId.fromString(accountId);
      const payTo = AccountId.fromString(requirements.payTo);

      const tx = new TransferTransaction();
      if (requirements.asset === HBAR_ASSET_ID) {
        tx.addHbarTransfer(payer, Hbar.fromTinybars((-amount).toString()));
        tx.addHbarTransfer(payTo, Hbar.fromTinybars(amount.toString()));
      } else {
        const tokenId = TokenId.fromString(requirements.asset);
        tx.addTokenTransfer(tokenId, payer, -amount);
        tx.addTokenTransfer(tokenId, payTo, amount);
      }
      tx.setTransactionId(TransactionId.generate(AccountId.fromString(feePayer)));

      const client = requirements.network === HEDERA_MAINNET_CAIP2 ? Client.forMainnet() : Client.forTestnet();
      try {
        tx.freezeWith(client);
        // DAppSigner.signTransaction assigns a node account id if missing and
        // returns the transaction signed by the connected wallet.
        const signedTx = await dAppSigner.signTransaction(tx);
        return Buffer.from(signedTx.toBytes()).toString('base64');
      } finally {
        client.close();
      }
    },
  };
}
