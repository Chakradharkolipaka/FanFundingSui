# Fan Funding Platform on Sui

A decentralized fan funding platform built on **Sui** where creators can mint NFTs and receive direct SUI donations from their supporters. Powered by Move smart contracts with Sui's object-centric model.

## 🚀 Network & Contract Info

- **Network**: Sui Testnet
- **Explorer**: [SuiScan](https://suiscan.xyz/testnet)
- **RPC**: `https://fullnode.testnet.sui.io:443`

## 🔑 Supported Wallets

- [Sui Wallet](https://chrome.google.com/webstore/detail/sui-wallet/)
- [Suiet](https://suiet.app/)
- [Ethos Wallet](https://ethoswallet.xyz/)
- [Nightly](https://nightly.app/)

## 💧 Testnet Faucet

```bash
sui client faucet
```
Or via [Sui Discord](https://discord.gg/sui) `#testnet-faucet` channel.

## 🛠️ Tech Stack

- **Blockchain**: Sui (Move)
- **Frontend**: Next.js 14, React, TailwindCSS, shadcn/ui
- **Wallet**: @mysten/dapp-kit
- **Storage**: IPFS via Pinata
- **Deploy**: Sui CLI

## 📦 Installation

```bash
npm install
cp env.local.example .env.local
# Fill in values after deploying the contract
npm run dev
```

## 🔗 Smart Contract (Move)

```bash
# Install Sui CLI
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# Build
cd contracts/sui
sui move build

# Test
sui move test

# Deploy
./scripts/deploy-sui.sh
```

## 🌐 Environment Variables

```env
NEXT_PUBLIC_PACKAGE_ID=0x...              # Published package ID
NEXT_PUBLIC_COLLECTION_ID=0x...           # Shared Collection object ID
NEXT_PUBLIC_SUI_NODE_URL=https://fullnode.testnet.sui.io:443
PINATA_JWT=...                            # Server-side Pinata JWT

# zkLogin (Google)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=...          # Google OAuth client id
ZKLOGIN_PROVER_URL=https://prover.testnet.sui.io/v1  # zkLogin prover endpoint (Mysten hosted, testnet)
```

## zkLogin Authentication

This dApp supports **two** ways to sign Sui transactions:

1) **Wallet extension** (existing): Sui Wallet / Suiet / etc.
2) **Google zkLogin** (new): sign in with Google and get a derived Sui address without requiring a wallet extension.

### How it works

At a high level:

User
↓
Google OAuth (GIS popup)
↓
Google ID Token (JWT)
↓
zkLogin prover (`ZKLOGIN_PROVER_URL`)
↓
Derived Sui Address
↓
Sign transaction with ephemeral key + zk proof

### Configuration

1. Create a Google OAuth Client ID (Web) in Google Cloud Console.
2. Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local`.
3. Set `ZKLOGIN_PROVER_URL` to a zkLogin prover endpoint (Mysten hosted or your own).
	- For Sui testnet, a common default is: `https://prover.testnet.sui.io/v1`
	- If you omit it locally, this repo falls back to the testnet default automatically.

### Session persistence & security

- zkLogin session metadata is stored in **localStorage**.
- The ephemeral private key is stored in **sessionStorage** (cleared when the browser session ends).
- Sessions automatically expire when the JWT expires.

## 🌐 Deployment

The app is deployed on Vercel:

```bash
npm run build
```

## 🔍 Block Explorer

- [SuiScan (Testnet)](https://suiscan.xyz/testnet)
- [SuiVision (Testnet)](https://testnet.suivision.xyz)
