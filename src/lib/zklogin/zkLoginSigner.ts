import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";

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

  async signAndExecuteTransaction(tx: Transaction): Promise<{ digest: string }> {
    // Ensure sender is set (required for correct intent + signature verification).
    tx.setSenderIfNotSet?.(this.session.address);
    // For SDK versions where Transaction doesn't have setSenderIfNotSet.
    if (!(tx as any).sender) {
      tx.setSender(this.session.address);
    }

    // Build BCS bytes for signing.
    const txBytes = await tx.build({ client: this.client });

    // The ephemeral secret is stored as a base64 string.
    // Depending on SDK version, `Ed25519Keypair#getSecretKey()` may encode:
    // - a 32-byte seed, or
    // - a 64-byte (seed || publicKey), or
    // - other extended formats.
    // `Ed25519Keypair.fromSecretKey` expects a 32-byte seed.
    const decoded = Buffer.from(this.session.ephemeralSecretKey, "base64");
    const seedBytes = decoded.length === 32 ? decoded : decoded.subarray(0, 32);
    if (seedBytes.length !== 32) {
      throw new Error(`Invalid ephemeral secretKey size: expected 32 bytes seed, got ${decoded.length}`);
    }
    const keypair = Ed25519Keypair.fromSecretKey(seedBytes);

    // Invariant: the proof inputs (ephemeralPublicKey) must match the key we sign with.
    if (this.session.ephemeralPublicKey) {
      const derivedEphemeralPublicKey = getExtendedEphemeralPublicKey(keypair.getPublicKey());
      if (derivedEphemeralPublicKey !== this.session.ephemeralPublicKey) {
        throw new Error("zkLogin session mismatch (ephemeral key changed). Please sign in again.");
      }
    }
    const { signature: userSignature } = await keypair.signTransaction(txBytes);

    const zkSig = getZkLoginSignature({
      inputs: {
        ...this.session.zkProof,
        addressSeed: this.session.addressSeed,
      },
      maxEpoch: this.session.maxEpoch,
      userSignature,
    });

    const res = await this.client.executeTransactionBlock({
      transactionBlock: txBytes,
      signature: zkSig,
      options: { showEffects: true },
    });

    return { digest: res.digest };
  }
}
