import { createRequire } from 'module';
const req = createRequire(import.meta.url);
const sdkPath = req.resolve('@hashgraph/sdk');
console.log('SDK main path:', sdkPath);
