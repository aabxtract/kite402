console.time('total');
console.log('Step 1: before imports');
const mod = await import('./src/index.ts');
console.log('Step 2: after imports');
console.timeEnd('total');
