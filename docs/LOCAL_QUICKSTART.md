# Local Development Quickstart: Stellar Quickstart & Meridian Relayer (`docker-compose`)

This guide explains how to spin up a local **Stellar Quickstart** node (Horizon + Soroban RPC + Friendbot) alongside the **Meridian Relayer** (`@meridian-protocol/relayer`) using [`docker-compose.yml`](../docker-compose.yml).

---

## 1. Services Overview

| Service | Container Name | Image | Exposed Port | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **`stellar-quickstart`** | `meridian-stellar-quickstart` | `stellar/quickstart:latest` | `8000` (`STELLAR_QUICKSTART_PORT`) | Local Stellar Core, Horizon, Friendbot, and Soroban RPC (`--local --enable rpc,horizon --protocol-version 22`) |
| **`meridian-relayer`** | `meridian-relayer` | `node:20-alpine` | Internal | Builds `@meridian-protocol/sdk` and runs `@meridian-protocol/relayer` (`services/relayer/src/index.ts`) |

---

## 2. Environment Variables

Configure the relayer and quickstart stack using shell environment variables or a local `.env` file (never commit `.env` or secret keys):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `STELLAR_QUICKSTART_PORT` | `8000` | Host port mapped to Stellar Quickstart HTTP gateway (`Horizon`, `Soroban RPC`, `Friendbot`). |
| `MERIDIAN_NETWORK` | `testnet` | Target Meridian network (`testnet` or `mainnet`). |
| `MERIDIAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint (`http://stellar-quickstart:8000/soroban/rpc` when targeting the local container). |
| `MERIDIAN_RELAYER_SECRET` | *(empty â€” dry-run status mode)* | Stellar Ed25519 secret key (`S...`) that fronts USDC liquidity in `MeridianRouter.execute_intent`. |
| `MERIDIAN_BURN_TX` | *(optional)* | Origin-chain CCTP V2 burn transaction hash (`0x...`) to watch and fast-fill. |
| `MERIDIAN_SOURCE_CHAIN` | `base` | Origin CCTP chain (`ethereum`, `avalanche`, `optimism`, `arbitrum`, `solana`, `base`, `polygon`). |
| `MERIDIAN_RECIPIENT` | *(defaults to relayer publicKey)* | Recipient Stellar address (`G...`) for the fast-fill output or vault shares. |
| `MERIDIAN_VAULT` | *(optional)* | Optional vault contract ID (`mvUSDC` or `maUSDC`) to deposit the filled USDC into. |

---

## 3. Running the Stack

### 3.1 Start Local Stellar Quickstart + Relayer Status Check

If `MERIDIAN_RELAYER_SECRET` is omitted, `meridian-relayer` starts in read-only inspection mode, verifies `MeridianRouter` configuration and deployed vault states, and exits cleanly:

```bash
docker compose up
```

### 3.2 Start with a Funded Relayer Account & Execute a Cross-Chain Fill

To watch a Circle CCTP V2 burn on Base and execute `MeridianRouter.execute_intent` on Stellar:

```bash
MERIDIAN_RELAYER_SECRET="S..." \
MERIDIAN_SOURCE_CHAIN="base" \
MERIDIAN_BURN_TX="0x..." \
MERIDIAN_RECIPIENT="G..." \
docker compose up
```

### 3.3 Pointing the Relayer at the Local Quickstart Soroban RPC

After deploying the workspace contracts (`node scripts/deploy.mjs`) against the local quickstart container:

```bash
MERIDIAN_RPC_URL="http://stellar-quickstart:8000/soroban/rpc" \
MERIDIAN_RELAYER_SECRET="S..." \
docker compose up
```

### 3.4 Stopping the Stack

```bash
docker compose down -v
```
