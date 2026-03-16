import type { SuiClient } from "@mysten/sui/client";
import type { Transaction } from "@mysten/sui/transactions";
import { getZkLoginSignature } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

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
    // Build BCS bytes for signing.
    const txBytes = await tx.build({ client: this.client });

  const keypair = Ed25519Keypair.fromSecretKey(this.session.ephemeralSecretKey);
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
