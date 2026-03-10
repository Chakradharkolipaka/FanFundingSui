// ─── Sui Configuration ──────────────────────────────────────────

/** Package ID on Sui — set via NEXT_PUBLIC_PACKAGE_ID env var */
export const PACKAGE_ID: string = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

/** Shared Collection object ID — set via NEXT_PUBLIC_COLLECTION_ID env var */
export const COLLECTION_ID: string = process.env.NEXT_PUBLIC_COLLECTION_ID || "";

/** Module name as published on-chain */
export const MODULE_NAME = "nft_donation";

/** Sui fullnode URL (testnet) */
export const SUI_NODE_URL: string =
  process.env.NEXT_PUBLIC_SUI_NODE_URL || "https://fullnode.testnet.sui.io:443";

/** Sui explorer base URL (testnet) */
export const EXPLORER_BASE_URL = "https://suiscan.xyz/testnet";

/** Shorthand used in the UI */
export const DONATION_TOKEN_SYMBOL = "SUI";

/** Number of decimals for SUI (MIST → SUI = 10^9) */
export const SUI_DECIMALS = 9;

/** Network label shown in the UI */
export const NETWORK_NAME = "Sui Testnet";
