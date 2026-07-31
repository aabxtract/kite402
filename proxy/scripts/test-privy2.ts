import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.PRIVY_APP_ID || 'dummy',
  process.env.PRIVY_APP_SECRET || 'dummy'
);

async function test() {
  console.log('Available privy.walletApi properties:', Object.keys(privy.walletApi));
  console.log('Available privy.walletApi.ethereum properties:', Object.keys(privy.walletApi.ethereum || {}));
}

test().catch(console.error);
