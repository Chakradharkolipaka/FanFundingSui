#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MOVE_DIR="$PROJECT_ROOT/contracts/sui"

echo "═══════════════════════════════════════════════════════"
echo "  FanFunding Sui Deployment"
echo "═══════════════════════════════════════════════════════"
echo ""

# Check Sui CLI
if ! command -v sui &>/dev/null; then
  echo "❌ Sui CLI not found."
  echo "   Install: https://docs.sui.io/build/install"
  echo "   Or: cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui"
  exit 1
fi

echo "📍 Sui CLI version: $(sui --version)"
echo "📍 Active address: $(sui client active-address)"
echo "📍 Active env: $(sui client active-env)"
echo ""

# Ensure testnet
read -rp "🌐 Switch to testnet? [Y/n]: " SWITCH
if [[ ! "$SWITCH" =~ ^[Nn]$ ]]; then
  sui client switch --env testnet 2>/dev/null || {
    echo "Adding testnet environment..."
    sui client new-env --alias testnet --rpc https://fullnode.testnet.sui.io:443
    sui client switch --env testnet
  }
  echo "✅ Switched to testnet"
  echo ""
fi

# Request testnet tokens
read -rp "💧 Request testnet SUI from faucet? [y/N]: " FUND
if [[ "$FUND" =~ ^[Yy]$ ]]; then
  echo "Requesting SUI from faucet..."
  sui client faucet
  echo "✅ Faucet request sent. Waiting a few seconds..."
  sleep 5
  echo ""
fi

# Build
echo "🔨 Building Move package..."
(cd "$MOVE_DIR" && sui move build)
echo "✅ Build successful"
echo ""

# Test
read -rp "🧪 Run Move unit tests? [y/N]: " TEST
if [[ "$TEST" =~ ^[Yy]$ ]]; then
  (cd "$MOVE_DIR" && sui move test)
  echo ""
fi

# Publish
echo "🚀 Publishing to Sui testnet..."
echo "   This will cost gas. Make sure you have testnet SUI."
echo ""

PUBLISH_OUTPUT=$(cd "$MOVE_DIR" && sui client publish --gas-budget 100000000 --json 2>&1)
echo "$PUBLISH_OUTPUT" | head -100

# Extract Package ID
PACKAGE_ID=$(echo "$PUBLISH_OUTPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
changes = data.get('objectChanges', [])
for c in changes:
    if c.get('type') == 'published':
        print(c['packageId'])
        break
" 2>/dev/null || echo "")

if [ -z "$PACKAGE_ID" ]; then
  echo ""
  echo "⚠️  Could not auto-extract Package ID."
  echo "   Please find it in the output above under 'published' objectChange."
  read -rp "   Enter Package ID manually: " PACKAGE_ID
fi

echo ""
echo "✅ Package published at: $PACKAGE_ID"
echo ""

# Initialize collection
read -rp "📦 Call init_collection now? [Y/n]: " INIT
COLLECTION_ID=""
if [[ ! "$INIT" =~ ^[Nn]$ ]]; then
  echo "Calling init_collection..."
  INIT_OUTPUT=$(sui client call \
    --package "$PACKAGE_ID" \
    --module nft_donation \
    --function init_collection \
    --gas-budget 10000000 \
    --json 2>&1)

  echo "$INIT_OUTPUT" | head -50

  # Extract Collection object ID (shared object created)
  COLLECTION_ID=$(echo "$INIT_OUTPUT" | python3 -c "
import sys, json
data = json.load(sys.stdin)
changes = data.get('objectChanges', [])
for c in changes:
    if c.get('type') == 'created' and 'Collection' in c.get('objectType', ''):
        print(c['objectId'])
        break
" 2>/dev/null || echo "")

  if [ -z "$COLLECTION_ID" ]; then
    echo ""
    echo "⚠️  Could not auto-extract Collection ID."
    echo "   Please find it in the output above under 'created' objectChange with type 'Collection'."
    read -rp "   Enter Collection ID manually: " COLLECTION_ID
  fi

  echo ""
  echo "✅ Collection initialized at: $COLLECTION_ID"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  🎉 Deployment Complete!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  Add these to your .env.local file:"
echo ""
echo "  NEXT_PUBLIC_PACKAGE_ID=$PACKAGE_ID"
echo "  NEXT_PUBLIC_COLLECTION_ID=$COLLECTION_ID"
echo "  NEXT_PUBLIC_SUI_NODE_URL=https://fullnode.testnet.sui.io:443"
echo ""
echo "  Then run: npm run dev"
echo ""
