import { Client, AccountCreateTransaction, PrivateKey, Hbar } from '@hashgraph/sdk';

const client = Client.forTestnet();
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!)
);

try {
  const newKey = PrivateKey.generateECDSA();
  const tx = await new AccountCreateTransaction()
    .setECDSAKeyWithAlias(newKey)
    .setInitialBalance(new Hbar(20))
    .execute(client);
  const receipt = await tx.getReceipt(client);
  console.log('Consumer account created');
  console.log(`CONSUMER_ACCOUNT_ID=${receipt.accountId}`);
  console.log(`CONSUMER_PRIVATE_KEY=0x${newKey.toStringRaw()}`);
} catch (err) {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  client.close();
}
