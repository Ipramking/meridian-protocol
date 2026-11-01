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
  const routerDeploy = await deployContract(kp, path.join(targetDir, 'meridian_router.wasm'));
  const paymasterDeploy = await deployContract(kp, path.join(targetDir, 'meridian_paymaster.wasm'));
  const complianceDeploy = await deployContract(kp, path.join(targetDir, 'meridian_compliance.wasm'));

  // Reference tokens on Testnet (Native XLM SAC + Testnet USDC SAC)
  const nativeAssetContract = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
  const testnetUsdcSac = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
  const adminAddr = new Address(kp.publicKey());

  console.log('Initializing MeridianRouter on-chain...');
  const routerContract = new Contract(routerDeploy.contractId);
  const routerInitRes = await submitAndAwait(
    kp,
    routerContract.call(
      'initialize',
      adminAddr.toScVal(),
      new Address(testnetUsdcSac).toScVal(),
      new Address(complianceDeploy.contractId).toScVal(),
      new Address(paymasterDeploy.contractId).toScVal(),
      nativeToScVal(500, { type: 'u32' })
    )
  );
  console.log(`  MeridianRouter initialized (tx: ${routerInitRes.hash})`);

  console.log('Initializing MeridianPaymaster on-chain...');
  const paymasterContract = new Contract(paymasterDeploy.contractId);
  const paymasterInitRes = await submitAndAwait(
    kp,
    paymasterContract.call(
      'initialize',
      adminAddr.toScVal(),
      new Address(testnetUsdcSac).toScVal(),
      new Address(nativeAssetContract).toScVal(),
      new Address(routerDeploy.contractId).toScVal(),
      nativeToScVal(150, { type: 'u32' })
    )
  );
  console.log(`  MeridianPaymaster initialized (tx: ${paymasterInitRes.hash})`);

  console.log('Initializing MeridianCompliance on-chain...');
  const complianceContract = new Contract(complianceDeploy.contractId);
  const complianceInitRes = await submitAndAwait(
    kp,
    complianceContract.call('initialize', adminAddr.toScVal())
  );
  console.log(`  MeridianCompliance initialized (tx: ${complianceInitRes.hash})`);

  const deploymentManifest = {
    network: 'Stellar Soroban Testnet',
    rpcUrl: RPC_URL,
    networkPassphrase: Networks.TESTNET,
    deployerPublicKey: kp.publicKey(),
    deployedAt: new Date().toISOString(),
    contracts: {
      meridianRouter: {
        ...routerDeploy,
        initTx: routerInitRes.hash,
        explorerUrl: `https://stellar.expert/explorer/testnet/contract/${routerDeploy.contractId}`,
      },
      meridianPaymaster: {
        ...paymasterDeploy,
        initTx: paymasterInitRes.hash,
        explorerUrl: `https://stellar.expert/explorer/testnet/contract/${paymasterDeploy.contractId}`,
      },
      meridianCompliance: {
        ...complianceDeploy,
        initTx: complianceInitRes.hash,
        explorerUrl: `https://stellar.expert/explorer/testnet/contract/${complianceDeploy.contractId}`,
      },
    },
  };

  fs.mkdirSync('deployments', { recursive: true });
  fs.writeFileSync('deployments/testnet.json', JSON.stringify(deploymentManifest, null, 2));
  console.log('Saved deployment manifest to deployments/testnet.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
