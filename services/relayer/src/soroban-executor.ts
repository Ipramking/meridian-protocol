import { Address, Keypair, StrKey, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import {
  MeridianClient,
  computeOrderId,
  encodeIntent,
  explorerTxUrl,
  hexToBuffer,
  type MeridianIntentParams,
  type MeridianNetwork,
} from '@meridian-protocol/sdk';

export interface FillResult {
  orderId: string;
  hash: string;
  ledger: number;
  amountOut: bigint;
  explorerUrl: string;
}

/** Signs and submits MeridianRouter.execute_intent with the relayer's own USDC */
export class SorobanExecutor {
  readonly client: MeridianClient;
  private readonly keypair: Keypair;

  constructor(secretKey: string, network: MeridianNetwork = 'testnet', rpcUrl?: string) {
    if (!secretKey) {
      throw new Error('MERIDIAN_RELAYER_SECRET is required: the relayer pays fills from its own account');
    }
    this.keypair = Keypair.fromSecret(secretKey);
    this.client = new MeridianClient(network, { rpcUrl });
  }

  get publicKey(): string {
    return this.keypair.publicKey();
  }

  /** The relayer's ed25519 key as a 32-byte word, for comparing against a CCTP mintRecipient */
  get mintRecipientWord(): string {
    return '0x' + Buffer.from(StrKey.decodeEd25519PublicKey(this.publicKey)).toString('hex');
  }

  async fill(intent: MeridianIntentParams, messageHashHex: string): Promise<FillResult> {
    const orderId = computeOrderId(intent, messageHashHex);
    if (await this.client.isFilled(orderId)) {
      throw new Error(`Order ${orderId} is already filled`);
    }

    // Simulation fails here (e.g. InsufficientBalance, VaultNotAllowed) before anything is signed
    const prepared = await this.client.prepareInvocation(
      this.publicKey,
      this.client.deployment.contracts.router,
      'execute_intent',
      [
        encodeIntent(intent),
        xdr.ScVal.scvBytes(hexToBuffer(messageHashHex, 32)),
        new Address(this.publicKey).toScVal(),
      ]
    );

    const tx = TransactionBuilder.fromXDR(prepared.xdr, this.client.config.networkPassphrase);
    tx.sign(this.keypair);
    const res = await this.client.submit(tx.toXDR());

    return {
      orderId,
      hash: res.hash,
      ledger: res.ledger,
      amountOut: BigInt(res.returnValue as bigint),
      explorerUrl: explorerTxUrl(this.client.config, res.hash),
    };
  }
}
