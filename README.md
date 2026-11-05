# Meridian Protocol

[![Contracts CI](https://github.com/Ipramking/meridian-protocol/actions/workflows/contracts.yml/badge.svg)](https://github.com/Ipramking/meridian-protocol/actions/workflows/contracts.yml)
[![SDK & Web CI](https://github.com/Ipramking/meridian-protocol/actions/workflows/sdk-and-web.yml/badge.svg)](https://github.com/Ipramking/meridian-protocol/actions/workflows/sdk-and-web.yml)
[![Testnet E2E](https://github.com/Ipramking/meridian-protocol/actions/workflows/testnet-e2e.yml/badge.svg)](https://github.com/Ipramking/meridian-protocol/actions/workflows/testnet-e2e.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Cross-chain capital router for Stellar. USDC arriving over Circle CCTP is fast-filled on Stellar by a relayer and routed through a Soroban router into allowlisted USDC vaults, with on-chain KYC gating for regulated vaults and a SEP-24 off-ramp to local currency.

- **App (Stellar testnet):** https://ipramking.github.io/meridian-protocol/
- **Architecture and trust model:** [ARCHITECTURE.md](ARCHITECTURE.md)
- **Deployment manifest:** [deployments/testnet.json](deployments/testnet.json)
- **Receipts from the last live end-to-end run:** [deployments/testnet-receipts.json](deployments/testnet-receipts.json)

## Status

Everything below marked **live** is deployed on Stellar **testnet** and exercised by [`scripts/e2e-testnet.mjs`](scripts/e2e-testnet.mjs) with fresh accounts and real Circle testnet USDC. Nothing is on mainnet yet.

| Capability | Status |
|---|---|
| Router deposit of a user's own USDC into an allowlisted vault | live (testnet) |
| Vault share accounting, withdrawals, manager-distributed yield | live (testnet) |
| On-chain KYC gate (`compliance.is_eligible`) for the accredited vault | live (testnet) |
| Relayer fast-fill through `execute_intent`, paid from the relayer's own USDC, with replay protection | live (testnet) |
| CCTP fee quotes for routes into Stellar (domain 27) from Circle Iris | live (Iris sandbox) |
| Relayer CLI that waits for a Circle attestation and checks domain, amount and mint recipient before filling | built; not yet run against a real origin-chain burn |
| SEP-10 sign-in and SEP-24 withdrawal against the SDF test anchor | live (testnet) |
| Soroswap swap leg inside the router | implemented and tested with a Soroswap-compatible mock; not exercised on testnet (no pool for Circle testnet USDC) |
| On-chain CCTP message verification (`receive_message`) | roadmap |
| Gasless onboarding via fee-bump sponsorship | roadmap (the paymaster contract only does fee accounting today) |
| Mainnet deployment | roadmap (`scripts/deploy.mjs --network mainnet --yes-mainnet`) |
| Security audit | none yet |

## Deployed contracts (Stellar testnet)

| Contract | Address |
|---|---|
| MeridianRouter | [`CD6BDASBGQNDY6K66ZWG5IVOZXAAJ3IWD2WWEA25KF6R6UTU6ZUWBOCR`](https://stellar.expert/explorer/testnet/contract/CD6BDASBGQNDY6K66ZWG5IVOZXAAJ3IWD2WWEA25KF6R6UTU6ZUWBOCR) |
| MeridianCompliance | [`CAHUSTNCX7KAQSB5P4AAFUTWCPJ5H2FEUAOX5RPGCVZO4E24TO5BQZFC`](https://stellar.expert/explorer/testnet/contract/CAHUSTNCX7KAQSB5P4AAFUTWCPJ5H2FEUAOX5RPGCVZO4E24TO5BQZFC) |
| Meridian Open USDC Vault (`mvUSDC`) | [`CAYGFI63GSSZL2PRN4QZ37UAQ6ITAPARJ4WDAO27765GWP2QNDW3LF6L`](https://stellar.expert/explorer/testnet/contract/CAYGFI63GSSZL2PRN4QZ37UAQ6ITAPARJ4WDAO27765GWP2QNDW3LF6L) |
| Meridian Accredited USDC Vault (`maUSDC`, KYC-gated) | [`CCTCBCSN2YT4UWGFI6XEL3P3TPZOKCXEWQAP4NCA4Q5B46ODE77DPPQH`](https://stellar.expert/explorer/testnet/contract/CCTCBCSN2YT4UWGFI6XEL3P3TPZOKCXEWQAP4NCA4Q5B46ODE77DPPQH) |
| MeridianPaymaster | [`CDIK7H27J4BCVQWSPMALTPXNVBRUZSCLR3PGCFCOVG2AJMY2RLN3C2AK`](https://stellar.expert/explorer/testnet/contract/CDIK7H27J4BCVQWSPMALTPXNVBRUZSCLR3PGCFCOVG2AJMY2RLN3C2AK) |

Wiring: router -> USDC SAC `CBIELTK6…DAMA` (Circle testnet USDC), Soroswap testnet router `CCJUD55A…7BRD`, compliance above; relayer fee capped on-chain at 100 bps. Every deploy, init and allowlist transaction is in [deployments/testnet.json](deployments/testnet.json).

### Verified run

The last end-to-end run (see [receipts](deployments/testnet-receipts.json)) bought USDC on the Stellar DEX, then:

- [router.deposit 10 USDC into the open vault](https://stellar.expert/explorer/testnet/tx/0b860476e0f8d3352121c9600c6a28a949f22a516a3c92ebde3c9a085e87d78b)
- [vault.withdraw half the shares](https://stellar.expert/explorer/testnet/tx/ff2627fddf6efbec6ca329ec7f9cb7009fef0e0816a070fe42b303eb6341a65c)
- was rejected from the accredited vault with `NotEligible`, then [verified by the compliance admin](https://stellar.expert/explorer/testnet/tx/52ebdc1732ef03c6914877bc464a93ab4f3bccf32a3bdb7f0199c560d0af68a5) and [deposited](https://stellar.expert/explorer/testnet/tx/1d9967e9fa76baec4a9ef8b4b791519c02c57fc419a1e68bb96f4e6b526d7acd)
- had a [relayer fill land in its vault position](https://stellar.expert/explorer/testnet/tx/5218d6902d28cb66562858f131f8b8f16d69df77ab3edf67c278be73f57a18d8) (a test intent: no origin-chain burn stands behind it), and the replay was rejected with `AlreadyFilled`

## How it works

**Stellar-native deposit.** A user calls `MeridianRouter.deposit(from, amount, vault)`. The router pulls the user's USDC, checks the vault is allowlisted (and, for gated vaults, that `compliance.is_eligible(from)`), approves the vault and calls `vault.deposit`, which only accepts calls from the router. Shares are minted 1:1 until the manager distributes realized yield.

**Cross-chain fast fill.** A user burns USDC on an EVM chain with CCTP to Stellar (domain 27), naming the relayer as mint recipient. The relayer waits for Circle's attestation, checks the attested message, and calls `execute_intent` with its **own** USDC. The router delivers to the recipient or a vault and records the fill under `sha256(message_hash || intent)`. The CCTP mint then repays the relayer. The router never spends a balance it holds, so a bad intent can only cost the relayer that signed it. See [ARCHITECTURE.md](ARCHITECTURE.md#trust-model) for what is and isn't enforced on-chain.

**Off-ramp.** The app signs a SEP-10 challenge with Freighter and starts a SEP-24 interactive withdrawal at the anchor.

## Security properties and the tests that check them

| Property | Test |
|---|---|
| Router funds can't be drained through `execute_intent` | `router::test_router_balance_cannot_be_drained` |
| A filled intent can't be replayed; fill records are persistent and outlive the 7-day deadline cap | `router::test_fill_uses_relayer_liquidity_and_blocks_replay`, `test_deadline_fee_and_amount_bounds` |
| Capital only reaches allowlisted vaults; gated vaults require eligibility | `router::test_vault_must_be_allowlisted`, `test_kyc_vault_requires_eligibility` |
| Vault deposits must come from the router | `vault::test_deposit_requires_router_auth` |
| Nested auth for Soroswap and the vault works without mocked signatures | `router::test_swap_leg_with_strict_auth`, `test_deposit_with_strict_auth` |
| Relayer fee capped (≤ 10% ceiling, 1% configured) | `router::test_router_initialization`, `test_deadline_fee_and_amount_bounds` |
| Withdrawals stay open while a vault is paused | `vault::test_vault_direct_deposit_and_pause` |

## Repository

```
contracts/
  router/       MeridianRouter: deposits, fast fills, vault allowlist, Soroswap leg
  vault/        USDC share vault (router-only deposits, manager-distributed yield)
  compliance/   KYC eligibility registry read by the router
  paymaster/    Fee accounting + USDC->XLM rebalance through Soroswap
packages/sdk/   @meridian-protocol/sdk: contract client, CCTP/Iris, DEX, SEP-10/24
services/relayer/  CLI that checks Circle attestations and fast-fills intents
apps/web/       Next.js app (Freighter) on GitHub Pages
scripts/        deploy.mjs (resumable deploy) and e2e-testnet.mjs (live run)
deployments/    testnet.json manifest and e2e receipts
```

## Development

Prerequisites: Rust with the `wasm32v1-none` target, Node.js 22.

```bash
npm install

# Contracts: build wasm (router tests import the vault/compliance wasm), then test
npm run contracts:test

# SDK unit tests
npm run test --workspace=@meridian-protocol/sdk

# Web app
npm run dev --workspace=@meridian-protocol/web

# Deploy to testnet (creates a funded admin key in the gitignored .env on first run)
npm run contracts:build && npm run build --workspace=@meridian-protocol/sdk
npm run deploy:testnet

# Live end-to-end run against the deployed contracts
npm run e2e:testnet

# Relayer
npm run build --workspace=@meridian-protocol/relayer
MERIDIAN_RELAYER_SECRET=S... node services/relayer/dist/index.js info
MERIDIAN_RELAYER_SECRET=S... node services/relayer/dist/index.js fill --source arbitrum --tx 0x... --recipient G... [--vault C...]
```

Never commit `.env` or paste secret keys anywhere; it is gitignored.

## License

Apache-2.0. Copyright (c) 2026 Ipramking.
