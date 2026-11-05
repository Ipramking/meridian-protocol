import {
  Account,
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import { NETWORKS, type MeridianNetwork, type NetworkConfig } from './networks.js';
import { getDeployment } from './deployments.js';
import { hexToBuffer } from './intent.js';
import type { MeridianDeployment, MeridianVaultDeployment } from './types.js';

export interface SimulationStats {
  minResourceFee: string;
  instructions: number;
  diskReadBytes: number;
  writeBytes: number;
}

export interface PreparedTransaction {
  xdr: string;
  stats: SimulationStats;
}

export interface SubmittedTransaction {
  hash: string;
  ledger: number;
  returnValue?: unknown;
}

export interface RouterConfigView {
  admin: string;
  usdcToken: string;
  soroswapRouter: string;
  compliance: string;
  maxRelayerFeeBps: number;
  paused: boolean;
}

export interface VaultView extends MeridianVaultDeployment {
  enabled: boolean;
  totalAssets: bigint;
  totalShares: bigint;
  paused: boolean;
  /** Underlying USDC per share (1.0 until yield is distributed) */
  sharePrice: number;
  account?: {
    shares: bigint;
    value: bigint;
    eligible: boolean;
  };
}

export interface ActivityEvent {
  type: 'fill' | 'deposit';
  ledger: number;
  closedAt: string;
  txHash: string;
  /** Recipient (fill) or depositor (deposit) */
  account: string;
  amountIn: bigint;
  amountOut: bigint;
  vault?: string;
  originDomain?: number;
}

const ROUTER_ERRORS: Record<number, string> = {
  1: 'AlreadyInitialized',
  2: 'NotInitialized',
  3: 'Unauthorized',
  4: 'ExpiredDeadline',
  5: 'SlippageExceeded',
  6: 'InvalidPath',
  7: 'ZeroAmount',
  10: 'RelayerFeeExceeded',
  12: 'AlreadyFilled',
  13: 'Paused',
  14: 'VaultNotAllowed',
  15: 'NotEligible',
  16: 'InvalidFeeConfig',
  17: 'DeadlineTooFar',
};

const VAULT_ERRORS: Record<number, string> = {
  1: 'AlreadyInitialized',
  2: 'NotInitialized',
  3: 'Unauthorized',
  4: 'ZeroAmount',
  5: 'InsufficientShares',
  6: 'Paused',
  7: 'NoShares',
};

const TOKEN_ERRORS: Record<number, string> = {
  6: 'AccountMissing',
  8: 'NegativeAmount',
  9: 'InsufficientAllowance',
  10: 'InsufficientBalance',
  11: 'BalanceDeauthorized',
  13: 'TrustlineMissing',
};

export class MeridianContractError extends Error {
  constructor(
    message: string,
    public readonly raw: string
  ) {
    super(message);
    this.name = 'MeridianContractError';
  }
}

export class MeridianClient {
  readonly config: NetworkConfig;
  readonly deployment: MeridianDeployment;
  readonly server: rpc.Server;

  constructor(
    network: MeridianNetwork = 'testnet',
    opts: { rpcUrl?: string; deployment?: MeridianDeployment } = {}
  ) {
    this.config = { ...NETWORKS[network], ...(opts.rpcUrl ? { rpcUrl: opts.rpcUrl } : {}) };
    this.deployment = opts.deployment ?? getDeployment(network);
    this.server = new rpc.Server(this.config.rpcUrl);
  }

  /** Turn a host error into the name of the contract error that caused it */
  describeError(raw: string): string {
    // Diagnostic events are listed newest first, so the last error event is where it started
    const matches = [...raw.matchAll(/contract:(C[A-Z2-7]{55}), topics:\[error, Error\(Contract, #(\d+)\)\]/g)];
    const origin = matches[matches.length - 1];
    const code = origin ? Number(origin[2]) : Number(/Error\(Contract, #(\d+)\)/.exec(raw)?.[1]);
    if (!Number.isFinite(code)) {
      return raw.split('\n')[0].slice(0, 200);
    }
    const contractId = origin?.[1];
    const { router } = this.deployment.contracts;
    let table: Record<number, string> = ROUTER_ERRORS;
    let label = 'router';
    if (contractId && this.deployment.vaults.some((v) => v.contractId === contractId)) {
      table = VAULT_ERRORS;
      label = 'vault';
    } else if (contractId && contractId !== router) {
      table = TOKEN_ERRORS;
      label = contractId === this.config.usdc.contractId ? 'USDC' : 'token';
    }
    return `${table[code] ?? 'Error'} (${label} error #${code})`;
  }

  private async simulateRead<T>(contractId: string, method: string, args: xdr.ScVal[] = []): Promise<T> {
    // Read-only calls only need a syntactically valid source; nothing is signed or submitted
    const source = new Account(this.deployment.admin, '0');
    const tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(30)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new MeridianContractError(this.describeError(sim.error), sim.error);
    }
    if (!sim.result) {
      throw new Error(`${method} returned no result`);
    }
    return scValToNative(sim.result.retval) as T;
  }

  async getRouterConfig(): Promise<RouterConfigView> {
    const c = await this.simulateRead<Record<string, any>>(this.deployment.contracts.router, 'get_config');
    return {
      admin: c.admin,
      usdcToken: c.usdc_token,
      soroswapRouter: c.soroswap_router,
      compliance: c.compliance,
      maxRelayerFeeBps: Number(c.max_relayer_fee_bps),
      paused: Boolean(c.paused),
    };
  }

  async isEligible(account: string): Promise<boolean> {
    return this.simulateRead<boolean>(this.deployment.contracts.compliance, 'is_eligible', [
      new Address(account).toScVal(),
    ]);
  }

  async getShares(vault: string, account: string): Promise<bigint> {
    return BigInt(
      await this.simulateRead<bigint>(vault, 'get_shares', [new Address(account).toScVal()])
    );
  }

  async isFilled(orderIdHex: string): Promise<boolean> {
    const fill = await this.simulateRead<unknown>(this.deployment.contracts.router, 'get_fill', [
      xdr.ScVal.scvBytes(hexToBuffer(orderIdHex, 32)),
    ]);
    return fill !== null && fill !== undefined;
  }

  /** Live state of every deployed vault, plus the account's position if given */
  async getVaults(account?: string): Promise<VaultView[]> {
    return Promise.all(
      this.deployment.vaults.map(async (v) => {
        const [meta, policy] = await Promise.all([
          this.simulateRead<Record<string, any>>(v.contractId, 'get_metadata'),
          this.simulateRead<Record<string, any> | null>(this.deployment.contracts.router, 'get_vault', [
            new Address(v.contractId).toScVal(),
          ]),
        ]);
        const totalAssets = BigInt(meta.total_assets);
        const totalShares = BigInt(meta.total_shares);
        const view: VaultView = {
          ...v,
          enabled: Boolean(policy?.enabled),
          totalAssets,
          totalShares,
          paused: Boolean(meta.paused),
          sharePrice: totalShares === 0n ? 1 : Number(totalAssets) / Number(totalShares),
        };
        if (account) {
          const [shares, eligible] = await Promise.all([
            this.getShares(v.contractId, account),
            v.requiresKyc ? this.isEligible(account) : Promise.resolve(true),
          ]);
          view.account = {
            shares,
            value: totalShares === 0n ? 0n : (shares * totalAssets) / totalShares,
            eligible,
          };
        }
        return view;
      })
    );
  }

  /** Build, simulate and assemble a contract call for `source` to sign */
  async prepareInvocation(
    source: string,
    contractId: string,
    method: string,
    args: xdr.ScVal[]
  ): Promise<PreparedTransaction> {
    const account = await this.server.getAccount(source);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(new Contract(contractId).call(method, ...args))
      .setTimeout(300)
      .build();

    const sim = await this.server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new MeridianContractError(this.describeError(sim.error), sim.error);
    }

    const { resources } = sim.transactionData.build();
    const stats: SimulationStats = {
      minResourceFee: sim.minResourceFee,
      instructions: resources.instructions,
      diskReadBytes: resources.diskReadBytes,
      writeBytes: resources.writeBytes,
    };

    return { xdr: rpc.assembleTransaction(tx, sim).build().toXDR(), stats };
  }

  /** Route the account's own USDC into a vault through MeridianRouter */
  prepareDeposit(from: string, amountUnits: bigint, vault: string): Promise<PreparedTransaction> {
    return this.prepareInvocation(from, this.deployment.contracts.router, 'deposit', [
      new Address(from).toScVal(),
      nativeToScVal(amountUnits, { type: 'i128' }),
      new Address(vault).toScVal(),
    ]);
  }

  prepareWithdraw(owner: string, vault: string, shares: bigint): Promise<PreparedTransaction> {
    return this.prepareInvocation(owner, vault, 'withdraw', [
      new Address(owner).toScVal(),
      nativeToScVal(shares, { type: 'i128' }),
    ]);
  }

  /** Submit a signed transaction and wait until it is in a ledger */
  async submit(signedXdr: string, timeoutMs = 45_000): Promise<SubmittedTransaction> {
    const tx = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);
    const sent = await this.server.sendTransaction(tx);
    if (sent.status === 'ERROR' || sent.status === 'TRY_AGAIN_LATER') {
      const code = sent.errorResult?.result.type ?? sent.status;
      throw new Error(`Transaction rejected by the network: ${code}`);
    }

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      let res: rpc.Api.GetTransactionResponse;
      try {
        res = await this.server.getTransaction(sent.hash);
      } catch {
        // A dropped poll doesn't mean the transaction failed; keep following the hash
        await new Promise((r) => setTimeout(r, 1_500));
        continue;
      }
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        return {
          hash: sent.hash,
          ledger: res.ledger,
          returnValue: res.returnValue ? scValToNative(res.returnValue) : undefined,
        };
      }
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction ${sent.hash} failed on-chain`);
      }
      await new Promise((r) => setTimeout(r, 1_500));
    }
    throw new Error(`Timed out waiting for ${sent.hash}`);
  }

  /** Router fills and deposits from the RPC's event window (newest first) */
  async getActivity(limit = 20): Promise<ActivityEvent[]> {
    const latest = await this.server.getLatestLedger();
    const filters: rpc.Api.EventFilter[] = [
      {
        type: 'contract',
        contractIds: [this.deployment.contracts.router],
        topics: [
          [xdr.ScVal.scvSymbol('fill').toXDR('base64'), '*'],
          [xdr.ScVal.scvSymbol('deposit').toXDR('base64'), '*'],
        ],
      },
    ];

    // RPC scans a bounded ledger range per request, so walk back from the newest
    // ledger in windows (4 at a time) until we have enough events or reach ~7 days.
    const WINDOW = 10_000;
    const MAX_WINDOWS = 12;
    const events: rpc.Api.EventResponse[] = [];
    for (let w = 0; w < MAX_WINDOWS && events.length < limit; w += 4) {
      const batch = await Promise.all(
        [0, 1, 2, 3].map(async (i) => {
          const endLedger = latest.sequence - (w + i) * WINDOW;
          const startLedger = Math.max(endLedger - WINDOW, 1);
          try {
            return (await this.server.getEvents({ startLedger, endLedger, filters, limit: 200 })).events;
          } catch {
            // Window older than this RPC's retention
            return [];
          }
        })
      );
      for (const page of batch) events.push(...page);
    }

    return events
      .sort((a, b) => b.ledger - a.ledger)
      .map((e): ActivityEvent => {
        const topic = scValToNative(e.topic[0]) as string;
        const account = scValToNative(e.topic[1]) as string;
        const data = scValToNative(e.value) as any[];
        if (topic === 'fill') {
          return {
            type: 'fill',
            ledger: e.ledger,
            closedAt: e.ledgerClosedAt,
            txHash: e.txHash,
            account,
            originDomain: Number(data[2]),
            amountIn: BigInt(data[3]),
            amountOut: BigInt(data[4]),
          };
        }
        return {
          type: 'deposit',
          ledger: e.ledger,
          closedAt: e.ledgerClosedAt,
          txHash: e.txHash,
          account,
          vault: String(data[0]),
          amountIn: BigInt(data[1]),
          amountOut: BigInt(data[2]),
        };
      })
      .slice(0, limit);
  }
}
