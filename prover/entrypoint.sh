#!/usr/bin/env sh
set -eu

# Prefer a specifically-named binary if it exists.
if [ -x "/app/bin/zklogin-prover" ]; then
  exec /app/bin/zklogin-prover
fi

# Otherwise, pick the first executable in /app/bin and run it.
BIN="$(find /app/bin -maxdepth 1 -type f -perm -111 | head -n 1 || true)"

if [ -z "$BIN" ]; then
  echo "No executable found in /app/bin (build might have failed or binary name changed)" >&2
  ls -la /app/bin >&2 || true
  exit 1
fi

echo "Starting prover binary: $BIN" >&2
exec "$BIN"
