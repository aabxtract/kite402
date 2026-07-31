import { TopicMessageSubmitTransaction, TopicId } from '@hashgraph/sdk';
import { getOperatorClient } from './hedera';

let _topicId: TopicId | null = null;

function getTopic(): TopicId {
  if (!_topicId) {
    const topicIdStr = process.env.HCS_TOPIC_ID;
    if (!topicIdStr || topicIdStr === '0.0.XXXXXX') {
      throw new Error('Valid HCS_TOPIC_ID required. Run scripts/create-hcs-topic.ts first.');
    }
    _topicId = TopicId.fromString(topicIdStr);
  }
  return _topicId;
}

async function submit(message: object) {
  const client = getOperatorClient();

  const response = await new TopicMessageSubmitTransaction()
    .setTopicId(getTopic())
    .setMessage(JSON.stringify(message))
    .execute(client);

  const receipt = await response.getReceipt(client);

  return {
    sequenceNumber: receipt.topicSequenceNumber,
    transactionId: response.transactionId.toString(),
  };
}

interface HCSLogEntry {
  endpointId: string;
  txId: string;
  token: string;
  amount: string;
  consumerAddress?: string;
  jti: string;
  timestamp: string;
}

export async function logToHCS(entry: HCSLogEntry) {
  return submit({
    v: 1,
    kind: 'access',
    endpoint: entry.endpointId,
    tx: entry.txId,
    token: entry.token,
    amount: entry.amount,
    consumer: entry.consumerAddress,
    jti: entry.jti,
    ts: entry.timestamp,
  });
}

interface WithdrawalLogEntry {
  /** The creator's embedded Hedera account. */
  fromAccountId: string;
  destination: string;
  /** Gross amount debited, in tinybars. */
  amountTinybars: string;
  /** Platform fee retained by the treasury, in tinybars. */
  feeTinybars: string;
  txId: string;
  timestamp: string;
}

export async function logWithdrawalToHCS(entry: WithdrawalLogEntry) {
  return submit({
    v: 1,
    kind: 'withdrawal',
    from: entry.fromAccountId,
    to: entry.destination,
    amount: entry.amountTinybars,
    fee: entry.feeTinybars,
    tx: entry.txId,
    ts: entry.timestamp,
  });
}
