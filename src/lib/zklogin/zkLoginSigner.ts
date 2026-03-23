import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";
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

  async signAndExecuteTransaction(tx: Transaction): Promise<{ digest: string }> {
    // Ensure sender is set (required for correct intent + signature verification).
    tx.setSenderIfNotSet?.(this.session.address);
    // For SDK versions where Transaction doesn't have setSenderIfNotSet.
    if (!(tx as any).sender) {
      tx.setSender(this.session.address);
    }

    // Reconstruct the ephemeral keypair from the stored secret key.
    // The secret is stored as a bech32 "suiprivkey1..." string (from Ed25519Keypair.getSecretKey()).
    // Ed25519Keypair.fromSecretKey() handles this format directly.
    const keypair = Ed25519Keypair.fromSecretKey(this.session.ephemeralSecretKey);

    // Invariant: the proof inputs (ephemeralPublicKey) must match the key we sign with.
    if (this.session.ephemeralPublicKey) {
      const derivedEphemeralPublicKey = getExtendedEphemeralPublicKey(keypair.getPublicKey());
      if (derivedEphemeralPublicKey !== this.session.ephemeralPublicKey) {
        clearAllZkLoginState();
        throw new Error("zkLogin session mismatch (ephemeral key changed). Please sign in again.");
      }
    }

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
