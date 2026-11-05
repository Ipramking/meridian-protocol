// Deploy and wire the Meridian contracts.
//
//   node scripts/deploy.mjs --network testnet
//   node scripts/deploy.mjs --network mainnet --yes-mainnet   (needs a funded MERIDIAN_ADMIN_SECRET)
//
// Writes deployments/<network>.json and regenerates packages/sdk/src/deployments.ts.
// The admin secret lives only in the gitignored .env.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Address,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from '@stellar/stellar-sdk';
import { NETWORKS } from '../packages/sdk/dist/index.js';
import { ROOT, arg, loadEnv, saveEnv } from './lib/env.mjs';

const network = arg('network', 'testnet');
const config = NETWORKS[network];
if (!config) throw new Error(`Unknown network: ${network}`);
if (network === 'mainnet' && arg('yes-mainnet') !== true) {
  throw new Error('Refusing to deploy to mainnet without --yes-mainnet');
}

loadEnv();
const rpcUrl = (network === 'mainnet' && process.env.MERIDIAN_MAINNET_RPC_URL) || config.rpcUrl;
const server = new rpc.Server(rpcUrl);
const WASM_DIR = path.join(ROOT, 'target', 'wasm32v1-none', 'release');
const MAX_RELAYER_FEE_BPS = 100; // 1% on-chain cap; the relayer's policy fee is 0.10%

async function adminKeypair() {
  if (process.env.MERIDIAN_ADMIN_SECRET) {
    return Keypair.fromSecret(process.env.MERIDIAN_ADMIN_SECRET);
  }
  if (network !== 'testnet') {
    throw new Error('Set MERIDIAN_ADMIN_SECRET in .env to a funded account before deploying to mainnet');
  }
  const kp = Keypair.random();
  saveEnv('MERIDIAN_ADMIN_SECRET', kp.secret());
  const res = await fetch(`${config.friendbotUrl}?addr=${kp.publicKey()}`);
  if (!res.ok) throw new Error(`Friendbot failed: ${await res.text()}`);
  console.log(`Created testnet admin ${kp.publicKey()} (secret saved to .env)`);
  return kp;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry transient network failures only; on-chain errors are thrown straight away */
async function withRetry(fn, label, tries = 6) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const transient = /fetch failed|ECONNRESET|ETIMEDOUT|ENOTFOUND|socket|network|503|502|504/i.test(
        `${err.message} ${err.cause?.code ?? ''}`
      );
      if (!transient || i >= tries) throw err;
      console.log(`  (${label}: ${err.cause?.code ?? err.message}, retry ${i}/${tries - 1})`);
      await sleep(2000 * i);
    }
  }
}

// Resumable progress, so a dropped connection never forces a full redeploy
const PROGRESS = path.join(ROOT, 'deployments', `.${network}-progress.json`);
const progress = fs.existsSync(PROGRESS) ? JSON.parse(fs.readFileSync(PROGRESS, 'utf8')) : {};
async function step(key, fn) {
  if (progress[key] !== undefined) return progress[key];
  progress[key] = await fn();
  fs.writeFileSync(PROGRESS, JSON.stringify(progress, null, 2));
  return progress[key];
}

async function submit(kp, op, label) {
  const account = await withRetry(() => server.getAccount(kp.publicKey()), label);
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: config.networkPassphrase })
    .addOperation(op)
    .setTimeout(120)
    .build();
  const prepared = await withRetry(() => server.prepareTransaction(tx), label);
  prepared.sign(kp);

  // Re-sending the same signed envelope is idempotent (same hash)
  const sent = await withRetry(() => server.sendTransaction(prepared), label);
  if (sent.status === 'ERROR') {
    throw new Error(`${label}: rejected (${sent.errorResult?.result.type ?? 'unknown'})`);
  }
  for (let i = 0; i < 40; i++) {
    await sleep(1500);
    const res = await withRetry(() => server.getTransaction(sent.hash), label);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      console.log(`  ${label}: ${sent.hash}`);
      return { hash: sent.hash, returnValue: res.returnValue ? scValToNative(res.returnValue) : undefined };
    }
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`${label}: failed on-chain (${sent.hash})`);
    }
  }
  throw new Error(`${label}: timed out (${sent.hash})`);
}

const invoke = (kp, contractId, method, args, label) =>
  submit(kp, Operation.invokeContractFunction({ contract: contractId, function: method, args }), label);

async function main() {
  const admin = await adminKeypair();
  const adminAddr = new Address(admin.publicKey()).toScVal();
  if (progress.admin && progress.admin !== admin.publicKey()) {
    throw new Error(`${PROGRESS} belongs to admin ${progress.admin}; delete it to start over`);
  }
  await step('admin', async () => admin.publicKey());
  const txs = {};
  const wasmHashes = {};

  console.log(`Deploying Meridian to ${network} as ${admin.publicKey()}`);

  const uploaded = {};
  for (const name of ['router', 'vault', 'compliance', 'paymaster']) {
    const wasm = fs.readFileSync(path.join(WASM_DIR, `meridian_${name}.wasm`));
    wasmHashes[name] = crypto.createHash('sha256').update(wasm).digest('hex');
    txs[`${name}Upload`] = await step(`upload:${wasmHashes[name]}`, async () =>
      (await submit(admin, Operation.uploadContractWasm({ wasm }), `upload ${name}`)).hash
    );
    uploaded[name] = Buffer.from(wasmHashes[name], 'hex');
  }

  async function create(name, label) {
    const res = await step(`create:${label}`, async () => {
      const r = await submit(
        admin,
        Operation.createCustomContract({
          address: new Address(admin.publicKey()),
          wasmHash: uploaded[name],
          salt: crypto.randomBytes(32),
        }),
        `create ${label}`
      );
      return { hash: r.hash, contractId: r.returnValue };
    });
    txs[`${label}Create`] = res.hash;
    return res.contractId;
  }

  const compliance = await create('compliance', 'compliance');
  const router = await create('router', 'router');
  const paymaster = await create('paymaster', 'paymaster');
  const openVault = await create('vault', 'openVault');
  const kycVault = await create('vault', 'accreditedVault');

  const usdc = new Address(config.usdc.contractId).toScVal();
  const soroswap = new Address(config.soroswapRouter).toScVal();
  const str = (s) => nativeToScVal(s, { type: 'string' });
  const call = (key, contractId, method, args, label) =>
    step(key, async () => (await invoke(admin, contractId, method, args, label)).hash).then((h) => (txs[key] = h));

  await call('complianceInit', compliance, 'initialize', [adminAddr], 'init compliance');
  await call(
    'routerInit',
    router,
    'initialize',
    [adminAddr, usdc, soroswap, new Address(compliance).toScVal(), nativeToScVal(MAX_RELAYER_FEE_BPS, { type: 'u32' })],
    'init router'
  );

  const vaults = [
    { id: 'open', contractId: openVault, name: 'Meridian Open USDC Vault', symbol: 'mvUSDC', requiresKyc: false },
    { id: 'accredited', contractId: kycVault, name: 'Meridian Accredited USDC Vault', symbol: 'maUSDC', requiresKyc: true },
  ];
  for (const v of vaults) {
    await call(
      `${v.id}VaultInit`,
      v.contractId,
      'initialize',
      [adminAddr, usdc, new Address(router).toScVal(), str(v.name), str(v.symbol)],
      `init ${v.id} vault`
    );
    await call(
      `${v.id}VaultAllowlist`,
      router,
      'set_vault',
      [new Address(v.contractId).toScVal(), nativeToScVal(true), nativeToScVal(v.requiresKyc)],
      `allowlist ${v.id} vault`
    );
  }

  await call(
    'paymasterInit',
    paymaster,
    'initialize',
    [adminAddr, usdc, new Address(config.nativeContractId).toScVal(), soroswap, nativeToScVal(150, { type: 'u32' })],
    'init paymaster'
  );

  const deployment = {
    network,
    deployedAt: new Date().toISOString(),
    admin: admin.publicKey(),
    contracts: { router, compliance, paymaster },
    vaults,
    wasmHashes,
    txs,
  };

  fs.writeFileSync(path.join(ROOT, 'deployments', `${network}.json`), JSON.stringify(deployment, null, 2) + '\n');
  writeSdkDeployments(network, deployment);
  fs.unlinkSync(PROGRESS);
  console.log(`\nDone. Router ${router}\nWrote deployments/${network}.json and packages/sdk/src/deployments.ts`);
}

function writeSdkDeployments(net, deployment) {
  const all = {};
  for (const n of ['testnet', 'mainnet']) {
    const file = path.join(ROOT, 'deployments', `${n}.json`);
    if (n === net) all[n] = deployment;
    else if (fs.existsSync(file)) all[n] = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  const body = `// Generated by scripts/deploy.mjs. Do not edit by hand.
import type { MeridianNetwork } from './networks.js';
import type { MeridianDeployment } from './types.js';

export const DEPLOYMENTS: Partial<Record<MeridianNetwork, MeridianDeployment>> = ${JSON.stringify(all, null, 2)};

export function getDeployment(network: MeridianNetwork): MeridianDeployment {
  const deployment = DEPLOYMENTS[network];
  if (!deployment) {
    throw new Error(\`Meridian is not deployed on \${network}\`);
  }
  return deployment;
}
`;
  fs.writeFileSync(path.join(ROOT, 'packages', 'sdk', 'src', 'deployments.ts'), body);
}

main().catch((err) => {
  console.error(`\nDeploy failed: ${err.message}`);
  process.exit(1);
});
