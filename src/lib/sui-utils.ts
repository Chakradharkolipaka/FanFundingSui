import { SUI_DECIMALS } from "@/constants";

// ─── Sui Utility Helpers ────────────────────────────────────────

/**
 * Shorten a Sui hex address for display.
 * e.g. "0xabcdef1234567890..." → "0xabcd...7890"
 */
export function shortenAddress(address: string): string {
  if (!address) return "";
  const clean = address.toLowerCase();
  if (clean.length <= 12) return clean;
  return `${clean.slice(0, 6)}...${clean.slice(-4)}`;
}

/**
 * Format MIST (10^9) to a human-readable SUI string.
 * Works with both bigint and number.
 */
export function formatEth(mist: bigint | number): string {
  const val = BigInt(mist);
  const divisor = BigInt(10 ** SUI_DECIMALS);
  const whole = val / divisor;
  const frac = val % divisor;
  const fracStr = frac
    .toString()
    .padStart(SUI_DECIMALS, "0")
    .slice(0, 6)
    .replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/**
 * Parse a SUI string to MIST (bigint).
 * e.g. "1.5" → 1500000000n
 */
export function parseEth(sui: string): bigint {
  const parts = sui.split(".");
  const whole = BigInt(parts[0] || "0") * BigInt(10 ** SUI_DECIMALS);
  if (!parts[1]) return whole;
  const fracStr = parts[1].padEnd(SUI_DECIMALS, "0").slice(0, SUI_DECIMALS);
  return whole + BigInt(fracStr);
}

/**
 * Build an explorer URL for a transaction digest on Sui testnet.
 */
export function explorerTxUrl(txDigest: string): string {
  return `https://suiscan.xyz/testnet/tx/${txDigest}`;
}

/**
 * Build an explorer URL for an account/object address on Sui testnet.
 */
export function explorerAccountUrl(address: string): string {
  return `https://suiscan.xyz/testnet/account/${address}`;
}

/**
 * Build an explorer URL for an object on Sui testnet.
 */
export function explorerObjectUrl(objectId: string): string {
  return `https://suiscan.xyz/testnet/object/${objectId}`;
}
