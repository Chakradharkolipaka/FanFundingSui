export type ZkLoginProvider = "google";

export type ZkProof = {
  proofPoints: any;
  issBase64Details: any;
  headerBase64: string;
};

export type ZkLoginSession = {
  provider: ZkLoginProvider;
  email?: string;
  picture?: string;

  /** Google ID token (JWT). We keep it only until expiry. */
  jwt: string;

  /** Epoch info used in nonce/proof generation */
  maxEpoch: number;

  /** Randomness used in nonce generation */
  randomness: string;

  /** Nonce used in the OAuth request / prover binding (optional but useful for debugging) */
  nonce?: string;

  /** Ephemeral public key (extended format string) used with the prover */
  ephemeralPublicKey?: string;

  /** Optional: raw Sui base64 (flag + pk) used for Enoki prover compatibility */
  ephemeralPublicKeySuiB64?: string;

  /** zkLogin derived address */
  address: string;

  /** Prover output */
  zkProof?: ZkProof;
  addressSeed?: string;

  /** JWT expiry in seconds since epoch */
  jwtExp?: number;

  /** Ephemeral private key seed (base64, 32 bytes). Needed to sign transactions with zkLogin. */
  ephemeralSecretKeySeedB64?: string;
};
