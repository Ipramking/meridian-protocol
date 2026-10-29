import { fetchCircleAttestation } from '@meridian-protocol/sdk';

export interface PendingCrossChainEvent {
  sourceChain: string;
  txHash: string;
  messageHash: string;
  recipient: string;
  amount: string;
  timestamp: number;
}

export class AttestationWatcher {
  private queue: PendingCrossChainEvent[] = [];

  public enqueueEvent(event: PendingCrossChainEvent) {
    console.log(`[Watcher] Enqueued transfer: ${event.txHash} on ${event.sourceChain}`);
    this.queue.push(event);
  }

  public async processNext(): Promise<{ event: PendingCrossChainEvent; attestation: string } | null> {
    if (this.queue.length === 0) return null;
    const item = this.queue[0];

    try {
      console.log(`[Watcher] Polling Circle Attestation for hash: ${item.messageHash}...`);
      const attestation = await fetchCircleAttestation(item.messageHash, 60_000);
      this.queue.shift();
      return { event: item, attestation };
    } catch (err) {
      console.error(`[Watcher] Attestation not ready yet: ${(err as Error).message}`);
      return null;
    }
  }
}
