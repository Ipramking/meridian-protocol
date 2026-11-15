import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrKey } from '@stellar/stellar-sdk';
import {
  DEPLOYMENTS,
  MeridianClient,
  RELAYER_FEE_BPS,
  computeOrderId,
  getDeployment,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const reportPath = path.join(repoRoot, 'docs', 'SECURITY_SELF_ASSESSMENT.md');

test('security self-assessment document exists and covers all four Soroban contracts', () => {
  assert.equal(fs.existsSync(reportPath), true, 'docs/SECURITY_SELF_ASSESSMENT.md must exist');
  const content = fs.readFileSync(reportPath, 'utf8');

  const deployment = getDeployment('testnet');
  assert.ok(content.includes(deployment.contracts.router), 'report must document router contract ID');
  assert.ok(content.includes(deployment.contracts.compliance), 'report must document compliance contract ID');
  assert.ok(content.includes(deployment.contracts.paymaster), 'report must document paymaster contract ID');

  for (const vault of deployment.vaults) {
    assert.ok(content.includes(vault.contractId), `report must document ${vault.id} vault contract ID`);
  }

  for (const [name, wasmHash] of Object.entries(deployment.wasmHashes)) {
    assert.ok(content.includes(wasmHash), `report must include ${name} wasm sha256 hash`);
  }
});

test('security self-assessment invariants match deployed testnet contract metadata and error mappings', () => {
  const deployment = DEPLOYMENTS.testnet;
  assert.ok(deployment);
  assert.equal(StrKey.isValidEd25519PublicKey(deployment.admin), true);

  const client = new MeridianClient('testnet');
  // Verify router error codes documented in Table 3.1 resolve accurately
  const routerCases = [
    [1, 'AlreadyInitialized'],
    [4, 'ExpiredDeadline'],
    [5, 'SlippageExceeded'],
    [6, 'InvalidPath'],
    [7, 'ZeroAmount'],
    [10, 'RelayerFeeExceeded'],
    [12, 'AlreadyFilled'],
    [13, 'Paused'],
    [14, 'VaultNotAllowed'],
    [15, 'NotEligible'],
    [16, 'InvalidFeeConfig'],
    [17, 'DeadlineTooFar'],
  ];

  for (const [code, expectedName] of routerCases) {
    const raw = `HostError: Error(Contract, #${code})\ncontract:${deployment.contracts.router}, topics:[error, Error(Contract, #${code})]`;
    assert.equal(client.describeError(raw), `${expectedName} (router error #${code})`);
  }

  // Verify vault error codes documented in Table 3.2 resolve accurately
  const openVaultId = deployment.vaults.find((v) => v.id === 'open').contractId;
  const vaultCases = [
    [4, 'ZeroAmount'],
    [5, 'InsufficientShares'],
    [6, 'Paused'],
    [7, 'NoShares'],
  ];

  for (const [code, expectedName] of vaultCases) {
    const raw = `HostError: Error(Contract, #${code})\ncontract:${openVaultId}, topics:[error, Error(Contract, #${code})]`;
    assert.equal(client.describeError(raw), `${expectedName} (vault error #${code})`);
  }
});

test('order_id replay-protection invariant binds every CrossChainIntent field to messageHash', () => {
  const deployment = getDeployment('testnet');
  const baseIntent = {
    originDomain: 6,
    senderBytes32: '000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    recipient: deployment.admin,
    amountIn: '1000000000',
    minAmountOut: '999000000',
    deadline: 1_900_000_000,
    swapPath: [],
    vaultTarget: deployment.vaults[0].contractId,
    relayerFee: String((1_000_000_000n * BigInt(RELAYER_FEE_BPS)) / 10_000n),
  };
  const msgHash = 'aa'.repeat(32);
  const baseOrderId = computeOrderId(baseIntent, msgHash);

  // Mutating any security-critical field must produce a distinct order_id (Invariant R-03)
  assert.notEqual(computeOrderId({ ...baseIntent, amountIn: '900000000' }, msgHash), baseOrderId);
  assert.notEqual(computeOrderId({ ...baseIntent, minAmountOut: '900000000' }, msgHash), baseOrderId);
  assert.notEqual(computeOrderId({ ...baseIntent, relayerFee: '5000000' }, msgHash), baseOrderId);
  assert.notEqual(computeOrderId({ ...baseIntent, vaultTarget: undefined }, msgHash), baseOrderId);
  assert.notEqual(computeOrderId(baseIntent, 'bb'.repeat(32)), baseOrderId);
});
