import 'dotenv/config';
import {
  MeridianSDK,
  fromUnits,
  getAccountBalances,
  type MeridianNetwork,
  type SourceChain,
} from '@meridian-protocol/sdk';
import { AttestationWatcher } from './attestation-watcher.js';
import { SorobanExecutor } from './soroban-executor.js';

export * from './attestation-watcher.js';
export * from './soroban-executor.js';

const USAGE = `Meridian relayer

  info
      Relayer account, USDC balance and router config.

  fill --source <chain> --tx <burnTxHash> --recipient <G...> [--vault <C...>] [--mainnet-iris]
      Wait for Circle to attest a CCTP burn to Stellar (domain 27), check the attested
      message, then fast-fill it through MeridianRouter.execute_intent from the
      relayer's own USDC. The burn's mintRecipient must be this relayer, so the CCTP
      mint repays the fill (override with --skip-repayment-check).

Env: MERIDIAN_RELAYER_SECRET (required), MERIDIAN_NETWORK (testnet|mainnet), MERIDIAN_RPC_URL`;

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
}

async function main(argv: string[]): Promise<void> {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') {
    console.log(USAGE);
    return;
  }

  const network = (process.env.MERIDIAN_NETWORK ?? 'testnet') as MeridianNetwork;
  const executor = new SorobanExecutor(process.env.MERIDIAN_RELAYER_SECRET ?? '', network, process.env.MERIDIAN_RPC_URL);

  if (command === 'info') {
    const [balances, config] = await Promise.all([
      getAccountBalances(executor.client.config, executor.publicKey),
      executor.client.getRouterConfig(),
    ]);
    console.log(`network      ${network}`);
    console.log(`relayer      ${executor.publicKey}`);
    console.log(`USDC         ${balances.hasUsdcTrustline ? balances.usdc : 'no trustline'}`);
    console.log(`router       ${executor.client.deployment.contracts.router}${config.paused ? ' (PAUSED)' : ''}`);
    console.log(`fee cap      ${config.maxRelayerFeeBps} bps`);
    return;
  }

  if (command === 'fill') {
    const source = flag(args, 'source') as SourceChain | undefined;
    const txHash = flag(args, 'tx');
    const recipient = flag(args, 'recipient');
    const vault = flag(args, 'vault');
    if (!source || !txHash || !recipient) {
      throw new Error('fill needs --source, --tx and --recipient');
    }

    const burn = await new AttestationWatcher(!args.includes('--mainnet-iris')).verifyBurn(source, txHash);
    console.log(`[relayer] attested: ${fromUnits(burn.amountUnits)} USDC from ${source}`);

    if (!args.includes('--skip-repayment-check') && burn.mintRecipient.toLowerCase() !== executor.mintRecipientWord) {
      throw new Error(
        `mintRecipient ${burn.mintRecipient} is not this relayer (${executor.mintRecipientWord}); the CCTP mint would not repay the fill`
      );
    }

    const intent = new MeridianSDK().buildIntent({
      sourceChain: source,
      senderAddressHex: burn.sender,
      recipientStellarAddress: recipient,
      amountInUnits: burn.amountUnits.toString(),
      minOutUnits: '0',
      path: [executor.client.config.usdc.contractId],
      vaultAddress: vault,
    });
    intent.minAmountOut = (BigInt(intent.amountIn) - BigInt(intent.relayerFee)).toString();

    const res = await executor.fill(intent, burn.messageHash);
    console.log(`[relayer] filled order ${res.orderId}: ${fromUnits(res.amountOut)} USDC -> ${vault ?? recipient}`);
    console.log(`[relayer] ${res.explorerUrl}`);
    return;
  }

  throw new Error(`Unknown command "${command}"\n\n${USAGE}`);
}

const isEntrypoint = process.argv[1] && /relayer[\\/]dist[\\/]index\.js$/.test(process.argv[1]);
if (isEntrypoint) {
  main(process.argv.slice(2)).catch((err) => {
    console.error(`error: ${err.message}`);
    process.exit(1);
  });
}
