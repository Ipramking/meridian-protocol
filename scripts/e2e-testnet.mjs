// Live end-to-end run against the deployed testnet contracts.
//
//   npm run build --workspace=@meridian-protocol/sdk && node scripts/e2e-testnet.mjs
//
// Uses fresh accounts and real Circle testnet USDC bought on the Stellar DEX.
// Every check throws on failure. On success the transaction receipts are written to
// deployments/testnet-receipts.json and packages/sdk/src/receipts.ts.
// With MERIDIAN_ADMIN_SECRET in .env it also exercises the KYC-gated vault.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Address, Keypair, TransactionBuilder, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import {
  MeridianClient,
  MeridianContractError,
  MeridianSDK,
  computeOrderId,
  encodeIntent,
  explorerTxUrl,
  fromUnits,
  fundWithFriendbot,
  getAccountBalances,
  prepareUsdcTrustline,
  prepareXlmToUsdcSwap,
  quoteXlmToUsdc,
  submitClassicTransaction,
  toUnits,
} from '../packages/sdk/dist/index.js';
import { ROOT, loadEnv } from './lib/env.mjs';

loadEnv();
const client = new MeridianClient('testnet');
const { config, deployment } = client;
const openVault = deployment.vaults.find((v) => v.id === 'open');
const kycVault = deployment.vaults.find((v) => v.id === 'accredited');
const receipts = [];

function check(condition, message) {
  if (!condition) throw new Error(`CHECK FAILED: ${message}`);
  console.log(`  ✓ ${message}`);
}

function record(step, res, detail) {
  receipts.push({ step, txHash: res.hash, ledger: res.ledger, detail });
  console.log(`  → ${explorerTxUrl(config, res.hash)}`);
}

async function retry(fn, tries = 5) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= tries || !/fetch failed|ECONNRESET|ETIMEDOUT|socket|network/i.test(`${err.message} ${err.cause?.code ?? ''}`)) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
}

async function expectContractError(promise, name) {
  try {
    await promise;
  } catch (err) {
    check(err instanceof MeridianContractError && err.message.includes(name), `rejected with ${name} (${err.message})`);
    return;
  }
  throw new Error(`CHECK FAILED: expected ${name}, but the call succeeded`);
}

async function signAndSubmit(kp, prepared) {
  const tx = TransactionBuilder.fromXDR(prepared.xdr, config.networkPassphrase);
  tx.sign(kp);
  return client.submit(tx.toXDR());
}

async function signAndSubmitClassic(kp, unsignedXdr) {
  const tx = TransactionBuilder.fromXDR(unsignedXdr, config.networkPassphrase);
  tx.sign(kp);
  return submitClassicTransaction(config, tx.toXDR());
}

async function usdcUnits(account) {
  return toUnits((await retry(() => getAccountBalances(config, account))).usdc);
}

/** Horizon can trail RPC by a ledger: wait until the balance moves off `previous` */
async function settledUsdc(account, previous) {
  for (let i = 0; i < 12; i++) {
    const value = await usdcUnits(account);
    if (value !== previous) return value;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return usdcUnits(account);
}

/** Fresh account holding real testnet USDC bought on the DEX */
async function fundedUsdcAccount(label, xlmToSwap) {
  const kp = Keypair.random();
  await retry(() => fundWithFriendbot(config, kp.publicKey()));
  await signAndSubmitClassic(kp, await retry(() => prepareUsdcTrustline(config, kp.publicKey())));

  const quote = await retry(() => quoteXlmToUsdc(config, xlmToSwap));
  check(quote && Number(quote.usdcOut) > 0, `${label}: DEX quotes ${xlmToSwap} XLM -> ${quote?.usdcOut} USDC`);
  const res = await signAndSubmitClassic(kp, await retry(() => prepareXlmToUsdcSwap(config, kp.publicKey(), quote)));
  const balance = await usdcUnits(kp.publicKey());
  check(balance > 0n, `${label} ${kp.publicKey().slice(0, 8)}… holds ${fromUnits(balance)} USDC`);
  record(`${label}: swap XLM for USDC on the Stellar DEX`, res, `${xlmToSwap} XLM -> ${fromUnits(balance)} USDC`);
  return kp;
}

async function main() {
  console.log(`Meridian testnet e2e against router ${deployment.contracts.router}\n`);

  console.log('[1] Fund a user with real testnet USDC');
  const user = await fundedUsdcAccount('user', '40');
  const u = user.publicKey();

  console.log('\n[2] Deposit 10 USDC into the open vault through MeridianRouter');
  const [before] = await client.getVaults(u);
  const deposit = await client.prepareDeposit(u, toUnits('10'), openVault.contractId);
  console.log(`  simulated: ${deposit.stats.instructions.toLocaleString()} instructions, resource fee ${deposit.stats.minResourceFee} stroops`);
  const depositRes = await signAndSubmit(user, deposit);
  const minted = BigInt(depositRes.returnValue);
  const [after] = await client.getVaults(u);
  check(minted > 0n, `router.deposit minted ${fromUnits(minted)} mvUSDC shares`);
  check(after.account.shares - before.account.shares === minted, 'vault share balance moved by exactly the minted amount');
  check(after.totalAssets - before.totalAssets === toUnits('10'), 'vault total assets rose by 10 USDC');
  record('user: router.deposit 10 USDC -> open vault', depositRes, `${fromUnits(minted)} shares minted`);

  console.log('\n[3] Withdraw half the shares');
  const usdcBefore = await usdcUnits(u);
  const withdrawRes = await signAndSubmit(user, await client.prepareWithdraw(u, openVault.contractId, minted / 2n));
  const assetsOut = BigInt(withdrawRes.returnValue);
  check(assetsOut > 0n, `vault.withdraw returned ${fromUnits(assetsOut)} USDC`);
  check((await settledUsdc(u, usdcBefore)) - usdcBefore === assetsOut, 'user USDC balance rose by exactly the withdrawn amount');
  record('user: vault.withdraw half the shares', withdrawRes, `${fromUnits(assetsOut)} USDC returned`);

  console.log('\n[4] KYC-gated vault rejects an unverified account');
  await expectContractError(client.prepareDeposit(u, toUnits('5'), kycVault.contractId), 'NotEligible');

  if (process.env.MERIDIAN_ADMIN_SECRET) {
    console.log('\n[5] Admin verifies the user, then the gated deposit succeeds');
    const admin = Keypair.fromSecret(process.env.MERIDIAN_ADMIN_SECRET);
    const verify = await client.prepareInvocation(admin.publicKey(), deployment.contracts.compliance, 'set_verification', [
      new Address(u).toScVal(),
      nativeToScVal(566, { type: 'u32' }),
      nativeToScVal(true),
      nativeToScVal(BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400), { type: 'u64' }),
    ]);
    const verifyRes = await signAndSubmit(admin, verify);
    check(await client.isEligible(u), 'compliance.is_eligible(user) is now true');
    record('admin: compliance.set_verification(user)', verifyRes, 'testnet KYC record, expires in 7 days');

    const gatedRes = await signAndSubmit(user, await client.prepareDeposit(u, toUnits('5'), kycVault.contractId));
    check(BigInt(gatedRes.returnValue) > 0n, `gated deposit minted ${fromUnits(BigInt(gatedRes.returnValue))} maUSDC shares`);
    record('user: router.deposit 5 USDC -> accredited vault', gatedRes, 'compliance check passed on-chain');
  } else {
    console.log('\n[5] SKIPPED: set MERIDIAN_ADMIN_SECRET in .env to exercise the KYC approval path');
  }

  console.log('\n[6] Relayer fast-fills an intent into the user\'s vault position');
  const relayer = await fundedUsdcAccount('relayer', '15');
  const r = relayer.publicKey();
  const intent = new MeridianSDK().buildIntent({
    sourceChain: 'arbitrum',
    senderAddressHex: crypto.randomBytes(20).toString('hex'),
    recipientStellarAddress: u,
    amountInUnits: toUnits('5').toString(),
    minOutUnits: '0',
    path: [config.usdc.contractId],
    vaultAddress: openVault.contractId,
  });
  intent.minAmountOut = (BigInt(intent.amountIn) - BigInt(intent.relayerFee)).toString();
  // Test intent: no origin-chain burn stands behind this message hash
  const messageHash = crypto.randomBytes(32).toString('hex');
  const orderId = computeOrderId(intent, messageHash);
  check(!(await client.isFilled(orderId)), `order ${orderId.slice(0, 12)}… is unfilled`);

  const [vaultBeforeFill] = await client.getVaults(u);
  const relayerUsdcBefore = await usdcUnits(r);
  const fillArgs = [
    encodeIntent(intent),
    xdr.ScVal.scvBytes(Buffer.from(messageHash, 'hex')),
    new Address(r).toScVal(),
  ];
  const fillRes = await signAndSubmit(
    relayer,
    await client.prepareInvocation(r, deployment.contracts.router, 'execute_intent', fillArgs)
  );
  const net = BigInt(intent.amountIn) - BigInt(intent.relayerFee);
  check(BigInt(fillRes.returnValue) === net, `execute_intent delivered ${fromUnits(net)} USDC net of a ${fromUnits(intent.relayerFee)} fee`);
  check(relayerUsdcBefore - (await settledUsdc(r, relayerUsdcBefore)) === net, 'the relayer paid the fill from its own balance');
  const [vaultAfterFill] = await client.getVaults(u);
  check(vaultAfterFill.account.shares > vaultBeforeFill.account.shares, 'the user\'s open-vault position grew');
  check(await client.isFilled(orderId), 'router.get_fill finds the SDK-computed order id (encodings match)');
  record('relayer: router.execute_intent 5 USDC -> user vault position', fillRes, `test intent (no origin burn), order ${orderId.slice(0, 16)}…`);

  console.log('\n[7] Replaying the same intent is rejected');
  await expectContractError(
    client.prepareInvocation(r, deployment.contracts.router, 'execute_intent', fillArgs),
    'AlreadyFilled'
  );

  console.log('\n[8] Router events are queryable');
  const activity = await client.getActivity(50);
  check(activity.some((e) => e.type === 'fill' && e.txHash === fillRes.hash), 'getActivity() returns the fill event');
  check(activity.some((e) => e.type === 'deposit' && e.txHash === depositRes.hash), 'getActivity() returns the deposit event');

  saveReceipts(u);
  console.log(`\nAll checks passed. ${receipts.length} transactions recorded.`);
}

function saveReceipts(account) {
  const file = path.join(ROOT, 'deployments', 'testnet-receipts.json');
  const runs = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  runs.unshift({ network: 'testnet', ranAt: new Date().toISOString(), account, receipts });
  const kept = runs.slice(0, 3);
  fs.writeFileSync(file, JSON.stringify(kept, null, 2) + '\n');

  const ts = fs.readFileSync(path.join(ROOT, 'packages', 'sdk', 'src', 'receipts.ts'), 'utf8');
  const head = ts.slice(0, ts.indexOf('export const RECEIPTS'));
  fs.writeFileSync(
    path.join(ROOT, 'packages', 'sdk', 'src', 'receipts.ts'),
    `${head}export const RECEIPTS: MeridianReceiptRun[] = ${JSON.stringify(kept, null, 2)};\n`
  );
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
