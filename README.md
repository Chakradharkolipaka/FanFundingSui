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
```

## 🌐 Deployment

The app is deployed on Vercel:

```bash
npm run build
```

## 🔍 Block Explorer

- [SuiScan (Testnet)](https://suiscan.xyz/testnet)
- [SuiVision (Testnet)](https://testnet.suivision.xyz)
