"use client";

import { useMemo } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import type { Transaction } from "@mysten/sui/transactions";
import { useWallet } from "@/lib/wallet";
import { clearAllZkLoginState, clearZkLoginSession, loadZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { ZkLoginSigner } from "@/lib/zklogin/zkLoginSigner";
import { getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

export type UnifiedSigner = {
  kind: "wallet" | "zklogin";
  address: string;
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>;
  logout?: () => void;
};

export function useSigner(): UnifiedSigner | null {
  const wallet = useWallet();
  const client = useSuiClient();

  return useMemo(() => {
    const session = loadZkLoginSession();
    if (session?.address) {
      // Ephemeral secret seed can be stored in the persisted session (preferred) or sessionStorage (back-compat).
      const secret =
        session.ephemeralSecretKeySeedB64 ||
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem("fanfunding:zklogin-ephemeral-secret:v1")
          : null);

      if (!secret || !session.ephemeralPublicKey) {
        // Session is incomplete (missing ephemeral secret/public key). Clear and force re-login to avoid
        // producing invalid signatures that surface as "Required Signature absent".
        clearAllZkLoginState();
        return null;
      }

      // Validate invariants early: derived extended pubkey from the seed must match what the prover used.
      try {
        const decoded = Buffer.from(secret, "base64");
        const seedBytes = decoded.length === 32 ? decoded : decoded.subarray(0, 32);
        if (seedBytes.length !== 32) throw new Error(`Invalid seed size: ${decoded.length}`);

        const keypair = Ed25519Keypair.fromSecretKey(seedBytes);
        const derived = getExtendedEphemeralPublicKey(keypair.getPublicKey());
        if (derived !== session.ephemeralPublicKey) {
          clearAllZkLoginState();
          return null;
        }
      } catch (err) {
        console.warn("[useSigner] Clearing stale zkLogin session due to seed/pubkey mismatch", err);
        clearAllZkLoginState();
        return null;
      }

      const signer = new ZkLoginSigner(client as any, {
        address: session.address,
        jwt: session.jwt,
        maxEpoch: session.maxEpoch,
        addressSeed: session.addressSeed!,
        zkProof: session.zkProof as any,
        ephemeralSecretKey: secret,
        ephemeralPublicKey: session.ephemeralPublicKey,
      });

      return {
        kind: "zklogin" as const,
        address: session.address,
        signAndExecute: (tx) => signer.signAndExecuteTransaction(tx),
        logout: () => {
          clearZkLoginSession();
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("fanfunding:zklogin-ephemeral-secret:v1");
          }
        },
      };
    }

    if (wallet.connected && wallet.address) {
      return {
        kind: "wallet" as const,
        address: wallet.address,
        signAndExecute: wallet.signAndExecuteTransaction,
      };
    }

    return null;
  }, [wallet.connected, wallet.address, wallet.signAndExecuteTransaction, client]);
}
