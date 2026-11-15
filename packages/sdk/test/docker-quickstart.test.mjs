import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const composePath = path.join(repoRoot, 'docker-compose.yml');
const docsPath = path.join(repoRoot, 'docs', 'LOCAL_QUICKSTART.md');

test('docker-compose.yml defines stellar-quickstart and meridian-relayer services with required env vars', () => {
  assert.equal(fs.existsSync(composePath), true, 'docker-compose.yml must exist at repository root');
  const content = fs.readFileSync(composePath, 'utf8');

  assert.ok(content.includes('stellar-quickstart:'), 'must define stellar-quickstart service');
  assert.ok(content.includes('stellar/quickstart:latest'), 'must use stellar/quickstart image');
  assert.ok(content.includes('rpc,horizon'), 'must enable rpc and horizon in stellar-quickstart');
  assert.ok(content.includes('meridian-relayer:'), 'must define meridian-relayer service');

  const requiredEnvVars = [
    'MERIDIAN_NETWORK',
    'MERIDIAN_RPC_URL',
    'MERIDIAN_RELAYER_SECRET',
    'MERIDIAN_BURN_TX',
    'MERIDIAN_SOURCE_CHAIN',
    'MERIDIAN_RECIPIENT',
    'MERIDIAN_VAULT',
  ];

  for (const envVar of requiredEnvVars) {
    assert.ok(content.includes(envVar), `docker-compose.yml must forward ${envVar}`);
  }
});

test('docs/LOCAL_QUICKSTART.md documents local quickstart usage and relayer environment variables', () => {
  assert.equal(fs.existsSync(docsPath), true, 'docs/LOCAL_QUICKSTART.md must exist');
  const doc = fs.readFileSync(docsPath, 'utf8');

  assert.ok(doc.includes('docker compose up'));
  assert.ok(doc.includes('MERIDIAN_RELAYER_SECRET'));
  assert.ok(doc.includes('http://stellar-quickstart:8000/soroban/rpc'));
});
