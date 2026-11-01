import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  Address,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';

const RPC_URL = 'https://soroban-testnet.stellar.org';
const server = new rpc.Server(RPC_URL);

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`RPC error (${method}): ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

async function pollTransactionRaw(hash) {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const result = await rpcCall('getTransaction', { hash });
    if (result.status === 'SUCCESS') {
      return result;
    }
    if (result.status === 'FAILED') {
      throw new Error(`Transaction failed on-chain: ${hash} - ${JSON.stringify(result)}`);
    }
  }
  throw new Error(`Timed out waiting for transaction: ${hash}`);
}

async function submitAndAwait(kp, op) {
  const account = await server.getAccount(kp.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const preparedTx = await server.prepareTransaction(tx);
  preparedTx.sign(kp);

  const sendResp = await rpcCall('sendTransaction', {
    transaction: preparedTx.toXDR(),
  });
  if (sendResp.status === 'ERROR') {
    throw new Error(`Send transaction failed: ${JSON.stringify(sendResp)}`);
  }

  const rawResult = await pollTransactionRaw(sendResp.hash);
  return { hash: sendResp.hash, rawResult };
}

function extractContractAddressFromPreimage(kpPublicKey, salt) {
  const networkId = crypto.createHash('sha256').update(Networks.TESTNET).digest();
  const preimage = xdr.HashIdPreimage.envelopeTypeContractId(
    new xdr.HashIdPreimageContractId({
      networkId,
      contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
        new xdr.ContractIdPreimageFromAddress({
          address: new Address(kpPublicKey).toScAddress(),
          salt,
        })
      ),
    })
  );
  const contractIdBytes = crypto.createHash('sha256').update(preimage.toXDR()).digest();
  return Address.contract(contractIdBytes).toString();
}

async function deployContract(kp, wasmPath) {
  const wasmBuffer = fs.readFileSync(wasmPath);
  const wasmHash = crypto.createHash('sha256').update(wasmBuffer).digest();
  console.log(`Uploading WASM (${wasmBuffer.length} bytes): ${path.basename(wasmPath)}...`);
  const uploadRes = await submitAndAwait(kp, Operation.uploadContractWasm({ wasm: wasmBuffer }));
  console.log(`  Uploaded WASM hash: ${wasmHash.toString('hex')} (tx: ${uploadRes.hash})`);

  const salt = crypto.randomBytes(32);
  const createRes = await submitAndAwait(
    kp,
    Operation.createCustomContract({
      address: new Address(kp.publicKey()),
      wasmHash,
      salt,
    })
  );

  const contractAddress = extractContractAddressFromPreimage(kp.publicKey(), salt);
  console.log(`  Deployed Contract ID: ${contractAddress} (tx: ${createRes.hash})`);
  return {
    contractId: contractAddress,
    wasmHash: wasmHash.toString('hex'),
    wasmUploadTx: uploadRes.hash,
    createContractTx: createRes.hash,
  };
}

async function main() {
  const kp = Keypair.random();
  console.log(`Generated Deployer Account: ${kp.publicKey()}`);
  console.log('Funding account via Stellar Testnet Friendbot...');
  const fbRes = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
  if (!fbRes.ok) {
    throw new Error(`Friendbot failed: ${await fbRes.text()}`);
  }
  console.log('Account funded on Stellar Testnet.');

  const targetDir = path.resolve('target/wasm32v1-none/release');
  const vaultDeploy = await deployContract(kp, path.join(targetDir, 'meridian_vault.wasm'));

  const testnetUsdcSac = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
  const routerContractId = 'CATRAXQGN7H73LDWWLUW3IBDNZG2XYQEUIVROC2UDOQ6XRPYEKK2WUED';
  const adminAddr = new Address(kp.publicKey());

  console.log('Initializing MeridianRwaVault on-chain...');
  const vaultContract = new Contract(vaultDeploy.contractId);
  const vaultInitRes = await submitAndAwait(
    kp,
    vaultContract.call(
      'initialize',
      adminAddr.toScVal(),
      new Address(testnetUsdcSac).toScVal(),
      new Address(routerContractId).toScVal(),
      nativeToScVal('Spiko Liquid Treasury Vault', { type: 'string' }),
      nativeToScVal('mTBILL', { type: 'string' }),
      nativeToScVal(425, { type: 'u32' })
    )
  );
  console.log(`  MeridianRwaVault initialized (tx: ${vaultInitRes.hash})`);

  const manifestPath = 'deployments/testnet.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  manifest.contracts.meridianVault = {
    ...vaultDeploy,
    initTx: vaultInitRes.hash,
    underlyingAsset: testnetUsdcSac,
    router: routerContractId,
    apyEstimate: '4.25%',
    explorerUrl: `https://stellar.expert/explorer/testnet/contract/${vaultDeploy.contractId}`,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Updated ${manifestPath} with MeridianRwaVault: ${vaultDeploy.contractId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
