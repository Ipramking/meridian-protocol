import { AttestationWatcher } from './attestation-watcher.js';
import { SorobanExecutor } from './soroban-executor.js';

async function runRelayerDaemon() {
  console.log('=== Meridian Protocol Relayer Service Started ===');
  const watcher = new AttestationWatcher();

  // Test seed event
  watcher.enqueueEvent({
    sourceChain: 'arbitrum',
    txHash: '0x3a4b9c1d2e...',
    messageHash: '0x99f8e7d6c5b4a3...',
    recipient: 'GDYF2...STELLAR',
    amount: '100000000',
    timestamp: Date.now(),
  });

  console.log('[Daemon] Listening for cross-chain events on CCTP Iris...');
}

if (process.env.NODE_ENV !== 'test') {
  runRelayerDaemon().catch(console.error);
}

export * from './attestation-watcher.js';
export * from './soroban-executor.js';
