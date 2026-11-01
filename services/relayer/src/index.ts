import { AttestationWatcher } from './attestation-watcher.js';
import { SorobanExecutor } from './soroban-executor.js';

export interface RelayerConfig {
  sourceDomain: number;
  stellarRpcUrl: string;
  circleIrisUrl: string;
  relayerSecretKey?: string;
}

export class MeridianRelayerService {
  private watcher: AttestationWatcher;
  private executor: SorobanExecutor;
  private isRunning = false;

  constructor(config?: Partial<RelayerConfig>) {
    this.watcher = new AttestationWatcher();
    this.executor = new SorobanExecutor(
      config?.relayerSecretKey || process.env.MERIDIAN_RELAYER_SECRET_KEY,
      config?.stellarRpcUrl || 'https://soroban-testnet.stellar.org'
    );
  }

  public getRelayerPublicKey(): string {
    return this.executor.getPublicKey();
  }

  public startDaemon(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('=== Meridian Protocol Relayer Service Active ===');
    console.log(`Relayer Stellar Account: ${this.getRelayerPublicKey()}`);
    console.log('Listening for inbound CCTP cross-chain intents on Domain 27...');
  }

  public stopDaemon(): void {
    this.isRunning = false;
    console.log('Relayer service stopped.');
  }

  public getWatcher(): AttestationWatcher {
    return this.watcher;
  }

  public getExecutor(): SorobanExecutor {
    return this.executor;
  }
}

// Auto-start if executed directly
if (process.env.NODE_ENV !== 'test' && typeof window === 'undefined') {
  const service = new MeridianRelayerService();
  service.startDaemon();
}

export * from './attestation-watcher.js';
export * from './soroban-executor.js';
