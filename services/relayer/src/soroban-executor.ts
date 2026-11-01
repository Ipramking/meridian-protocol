import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { MERIDIAN_ROUTER_CONTRACT, MeridianIntentParams } from '@meridian-protocol/sdk';

export interface IntentExecutionResult {
  status: 'SUCCESS' | 'SIMULATED' | 'FAILED';
  transactionHash: string;
  minResourceFee?: string;
  cpuInstructions?: number;
  memoryBytes?: number;
  returnValue?: any;
  error?: string;
}

export class SorobanExecutor {
  private relayerKeypair: Keypair;
  private serverRpc: rpc.Server;
  private rpcUrl: string;

  constructor(secretKey?: string, rpcUrl = 'https://soroban-testnet.stellar.org') {
    this.relayerKeypair = secretKey ? Keypair.fromSecret(secretKey) : Keypair.random();
    this.rpcUrl = rpcUrl;
    this.serverRpc = new rpc.Server(rpcUrl);
  }

  public getPublicKey(): string {
    return this.relayerKeypair.publicKey();
  }

  /**
   * Encodes a MeridianIntentParams into a Soroban ScVal matching Rust CrossChainIntent
   */
  private encodeIntentScVal(intent: MeridianIntentParams): xdr.ScVal {
    const swapPathScVals = (intent.swapPath || []).map((addr) => new Address(addr).toScVal());

    const fields: xdr.ScMapEntry[] = [
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('amount_in'),
        val: nativeToScVal(BigInt(intent.amountIn), { type: 'i128' }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('deadline'),
        val: nativeToScVal(BigInt(intent.deadline), { type: 'u64' }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('min_amount_out'),
        val: nativeToScVal(BigInt(intent.minAmountOut), { type: 'i128' }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('origin_domain'),
        val: nativeToScVal(intent.originDomain, { type: 'u32' }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('recipient'),
        val: new Address(intent.recipient).toScVal(),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('relayer_fee'),
        val: nativeToScVal(BigInt(intent.relayerFee), { type: 'i128' }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('sender'),
        val: nativeToScVal(Buffer.from(intent.senderBytes32.replace(/^0x/, ''), 'hex'), { type: 'bytes' }),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('swap_path'),
        val: xdr.ScVal.scvVec(swapPathScVals),
      }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol('vault_target'),
        val: intent.vaultTarget
          ? xdr.ScVal.scvVec([new Address(intent.vaultTarget).toScVal()])
          : xdr.ScVal.scvVec([]),
      }),
    ];

    return xdr.ScVal.scvMap(fields);
  }

  /**
   * Executes or simulates MeridianRouter.execute_intent on Stellar Soroban Testnet
   */
  public async submitIntentExecution(params: {
    intent: MeridianIntentParams;
    messageHashBytes32: string;
    attestationBytes?: string;
  }): Promise<IntentExecutionResult> {
    const relayerPub = this.relayerKeypair.publicKey();
    const routerContract = new Contract(MERIDIAN_ROUTER_CONTRACT);

    // 1. Fetch live account or fallback to temporary dummy account for simulation
    let account;
    try {
      account = await this.serverRpc.getAccount(relayerPub);
    } catch {
      account = new (TransactionBuilder as any).Account(relayerPub, '1');
    }

    const cleanHash = params.messageHashBytes32.replace(/^0x/, '');
    const messageHashBuffer = Buffer.from(cleanHash.padEnd(64, '0').slice(0, 64), 'hex');

    const intentScVal = this.encodeIntentScVal(params.intent);
    const messageHashScVal = nativeToScVal(messageHashBuffer, { type: 'bytes' });
    const relayerScVal = new Address(relayerPub).toScVal();

    // 2. Build transaction operation
    const op = routerContract.call('execute_intent', intentScVal, messageHashScVal, relayerScVal);

    const tx = new TransactionBuilder(account, {
      fee: '100000',
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    // 3. Perform real simulation via Soroban RPC
    console.log(`[SorobanExecutor] Simulating intent on-chain against router: ${MERIDIAN_ROUTER_CONTRACT}...`);
    const simResult = await this.serverRpc.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simResult)) {
      console.warn(`[SorobanExecutor] Simulation reverted as expected (or missing pre-fund): ${simResult.error}`);
      return {
        status: 'FAILED',
        transactionHash: tx.hash().toString('hex'),
        error: simResult.error,
      };
    }

    // 4. If simulation succeeded and account is funded on-chain, attempt broadcast
    try {
      const preparedTx = await this.serverRpc.prepareTransaction(tx);
      preparedTx.sign(this.relayerKeypair);

      const sendResp = await this.serverRpc.sendTransaction(preparedTx);
      if (sendResp.status === 'PENDING') {
        let getTx = await this.serverRpc.getTransaction(sendResp.hash);
        for (let i = 0; i < 20 && getTx.status === 'NOT_FOUND'; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          getTx = await this.serverRpc.getTransaction(sendResp.hash);
        }
        return {
          status: getTx.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
          transactionHash: sendResp.hash,
          minResourceFee: simResult.minResourceFee,
          cpuInstructions: (simResult as any).cost?.cpuInsns,
          memoryBytes: (simResult as any).cost?.memBytes,
        };
      }
    } catch {
      // Fallback to simulation result if unfunded relayer key
    }

    // Return the real deterministic transaction hash computed by stellar-sdk
    const realTxHash = tx.hash().toString('hex');
    console.log(`[SorobanExecutor] Simulated transaction verified: ${realTxHash}`);
    return {
      status: 'SIMULATED',
      transactionHash: realTxHash,
      minResourceFee: simResult.minResourceFee,
      cpuInstructions: (simResult as any).cost?.cpuInsns,
      memoryBytes: (simResult as any).cost?.memBytes,
    };
  }
}
