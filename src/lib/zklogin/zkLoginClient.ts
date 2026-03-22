import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateRandomness,
  generateNonce,
  getExtendedEphemeralPublicKey,
} from "@mysten/sui/zklogin";
import type { SuiClient } from "@mysten/sui/client";

export type ZkLoginInitResult = {
  ephemeralKeypair: Ed25519Keypair;
  // public key used for proving (extended format)
  ephemeralPublicKey: string;
  // public key in Sui base64 (flag byte + raw pk), required by Enoki API
  ephemeralPublicKeySuiB64: string;
  randomness: string;
  maxEpoch: number;
  nonce: string;
};

/**
 * Creates the values required for the zkLogin flow:
 * - ephemeral keypair
 * - randomness
 * - maxEpoch (based on current epoch)
 * - nonce (bound to ephemeral pubkey + maxEpoch + randomness)
 */
export async function initZkLogin(client: SuiClient): Promise<ZkLoginInitResult> {
  const ephemeralKeypair = new Ed25519Keypair();
  const randomness = generateRandomness();

  const { epoch } = await client.getLatestSuiSystemState();
  // Keep it short so sessions don't linger. Typical examples use + 2.
  const maxEpoch = Number(epoch) + 2;

  const publicKey = ephemeralKeypair.getPublicKey();
  const ephemeralPublicKey = getExtendedEphemeralPublicKey(publicKey);
  // Enoki HTTP API expects base64 of `PublicKey.toSuiBytes()` (flag + raw pk = 33 bytes)
  const ephemeralPublicKeySuiB64 = Buffer.from(publicKey.toSuiBytes()).toString("base64");
  const nonce = generateNonce(publicKey, maxEpoch, randomness);

  return {
    ephemeralKeypair,
    ephemeralPublicKey,
    ephemeralPublicKeySuiB64,
    randomness,
    maxEpoch,
    nonce,
  };
}

export function exportEphemeralKeypairSecret(ephemeralKeypair: Ed25519Keypair): string {
  // Persist only in sessionStorage (not localStorage).
  return ephemeralKeypair.getSecretKey();
}
