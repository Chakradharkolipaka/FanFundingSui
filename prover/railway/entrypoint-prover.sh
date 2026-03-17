#!/usr/bin/env sh
set -eu

# NOTE:
# - Railway volumes can accidentally be mounted on /app/binaries, hiding the image's proverServer.
# - Also, the prover requires BOTH env vars: ZKEY and WITNESS_BINARIES.
#
# We keep the image's /app/binaries untouched and place the injected zkey in /tmp.

if [ -z "${ZKEY_BASE64:-}" ]; then
  echo "Missing ZKEY_BASE64 env var." >&2
  echo "Set ZKEY_BASE64 to base64(zkLogin.zkey) in your Railway service variables." >&2
  exit 1
fi

ZKEY_PATH="/tmp/zkLogin.zkey"

echo "$ZKEY_BASE64" | base64 -d > "$ZKEY_PATH"

if [ ! -s "$ZKEY_PATH" ]; then
  echo "Decoded zkey is missing or empty at $ZKEY_PATH" >&2
  exit 1
fi

# proverServer supports either:
#   ./proverServer <zkLogin.zkey> <path_to_binaries>
# or env vars:
#   ZKEY + WITNESS_BINARIES
export ZKEY="$ZKEY_PATH"
export WITNESS_BINARIES="${WITNESS_BINARIES:-/app/binaries}"

echo "[railway-entrypoint] Starting proverServer with:" >&2
echo "  ZKEY=$ZKEY" >&2
echo "  WITNESS_BINARIES=$WITNESS_BINARIES" >&2

exec /app/binaries/proverServer
