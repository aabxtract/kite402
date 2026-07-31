import { Client, TopicCreateTransaction, PrivateKey } from '@hashgraph/sdk';

const client = Client.forTestnet();
client.setOperator(
  process.env.HEDERA_ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.HEDERA_PRIVATE_KEY!)
);

async function main() {
  const txResponse = await new TopicCreateTransaction()
    .setTopicMemo('x402-gateway-audit-trail')
    .execute(client);

  const receipt = await txResponse.getReceipt(client);
  console.log(`HCS Topic created: ${receipt.topicId}`);
  console.log(`HashScan: https://hashscan.io/testnet/topic/${receipt.topicId}`);
  console.log(`\nAdd to .env:\nHCS_TOPIC_ID=${receipt.topicId}`);
}

main()
  .catch((err) => {
    console.error('Topic creation failed:', err?.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => client.close());
