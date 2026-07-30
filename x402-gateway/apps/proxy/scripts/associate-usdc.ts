import { Client, TokenAssociateTransaction, PrivateKey, AccountId, TokenId } from '@hashgraph/sdk';

const USDC_TOKEN_ID = '0.0.429274'; // Hedera testnet USDC

const client = Client.forTestnet();
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!)
);

try {
  const tx = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!))
    .setTokenIds([TokenId.fromString(USDC_TOKEN_ID)])
    .execute(client);
  await tx.getReceipt(client);
  console.log('USDC token associated');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('TOKEN_ALREADY_ASSOCIATED')) {
    console.log('USDC already associated — nothing to do');
  } else {
    console.error('Association failed:', msg);
    process.exitCode = 1;
  }
} finally {
  client.close();
}
