import { logToHCS } from '../src/services/hcs';
const result = await logToHCS({
  endpointId: 'test-endpoint',
  txId: 'test-tx',
  token: 'HBAR',
  amount: '10000000',
  consumerAddress: '0.0.12345',
  jti: 'test-jti-001',
  timestamp: new Date().toISOString(),
});
console.log('HCS log OK:', JSON.stringify({ seq: result.sequenceNumber?.toString(), tx: result.transactionId }));
process.exit(0);
