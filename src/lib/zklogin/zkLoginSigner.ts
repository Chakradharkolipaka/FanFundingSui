import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import {
  getZkLoginSignature,
  getExtendedEphemeralPublicKey,
  computeZkLoginAddressFromSeed,
} from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeJwt } from "jose";
import { clearAllZkLoginState } from "./zkLoginSession";

export type ZkLoginProof = {
  proofPoints: any;
  issBase64Details: any;
  headerBase64: string;
};

export type ZkLoginSignerSession = {
  address: string;
  jwt: string;
  maxEpoch: number;
  addressSeed: string;
  zkProof: ZkLoginProof;
  ephemeralSecretKey: string;
  ephemeralPublicKey?: string;
};

export class ZkLoginSigner {
  constructor(
    private client: SuiClient,
    private session: ZkLoginSignerSession
  ) {}

  getAddress() {
    return this.session.address;
  }

  /**
   * Pre-flight validation: catch every possible mismatch BEFORE hitting the network.
   * Each check corresponds to a specific "Invalid user signature" failure mode.
   */
  private async preflight(keypair: Ed25519Keypair): Promise<void> {
    // 1. Epoch check — if maxEpoch has passed, the proof is invalid
    try {
      const { epoch } = await this.client.getLatestSuiSystemState();
      if (Number(epoch) > this.session.maxEpoch) {
        clearAllZkLoginState();
        throw new Error(
          `zkLogin session expired (current epoch ${epoch} > maxEpoch ${this.session.maxEpoch}). Please sign in again.`
        );
      }
    } catch (e: any) {
      // Only rethrow our own errors; swallow network blips
      if (e.message?.includes("zkLogin session expired")) throw e;
    }

    // 2. Ephemeral key check — the keypair we'll sign with must match the proof's public key
    if (this.session.ephemeralPublicKey) {
      const derivedEpk = getExtendedEphemeralPublicKey(keypair.getPublicKey());
      if (derivedEpk !== this.session.ephemeralPublicKey) {
        clearAllZkLoginState();
        throw new Error("zkLogin ephemeral key mismatch — session corrupted. Please sign in again.");
      }
    }

    // 3. Address ↔ addressSeed consistency — the proof's addressSeed + JWT iss MUST derive this address
    try {
      const decoded: any = decodeJwt(this.session.jwt);
      const iss = decoded?.iss as string | undefined;
      if (iss) {
        const expectedAddress = computeZkLoginAddressFromSeed(
          BigInt(this.session.addressSeed),
          iss
        );
        const sessionAddr = this.session.address.toLowerCase();
        const expectedAddr = String(expectedAddress).toLowerCase();
        if (sessionAddr !== expectedAddr) {
          console.error(
            `[zkLoginSigner] Address mismatch! session=${sessionAddr}, derived=${expectedAddr}, addressSeed=${this.session.addressSeed}, iss=${iss}`
          );
          clearAllZkLoginState();
          throw new Error(
            "zkLogin address does not match proof inputs. Please sign out and sign in again."
          );
        }
      }
    } catch (e: any) {
      if (e.message?.includes("zkLogin address does not match")) throw e;
      // JWT decode or derivation failure — log but don't block (edge case)
      console.warn("[zkLoginSigner] preflight address check skipped:", e.message);
    }
  }

  async signAndExecuteTransaction(tx: Transaction): Promise<{ digest: string }> {
    // Reconstruct the ephemeral keypair from the stored secret key.
    // The secret is stored as a bech32 "suiprivkey1..." string (from Ed25519Keypair.getSecretKey()).
    // Ed25519Keypair.fromSecretKey() handles this format directly.
    let keypair: Ed25519Keypair;
    try {
      keypair = Ed25519Keypair.fromSecretKey(this.session.ephemeralSecretKey);
    } catch (e: any) {
      clearAllZkLoginState();
      throw new Error("Failed to reconstruct ephemeral key — session corrupted. Please sign in again.");
    }

    // Run pre-flight checks (epoch, key match, address↔seed match)
    await this.preflight(keypair);

    // Ensure sender is set (required for correct intent + signature verification).
    tx.setSender(this.session.address);

    // Sign transaction with ephemeral key using tx.sign() (matches reference app pattern)
    const { bytes, signature: userSignature } = await tx.sign({
      client: this.client,
      signer: keypair,
    });

    const zkSig = getZkLoginSignature({
      inputs: {
        ...this.session.zkProof,
        addressSeed: this.session.addressSeed,
      },
      maxEpoch: this.session.maxEpoch,
      userSignature,
    });

    const res = await this.client.executeTransactionBlock({
      transactionBlock: bytes,
      signature: zkSig,
      options: { showEffects: true },
    });

    return { digest: res.digest };
  }
}
