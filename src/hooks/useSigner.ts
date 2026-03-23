"use client";

import { useMemo } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import type { Transaction } from "@mysten/sui/transactions";
import { useWallet } from "@/lib/wallet";
import { clearAllZkLoginState, clearZkLoginSession, loadZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { ZkLoginSigner } from "@/lib/zklogin/zkLoginSigner";
import { getExtendedEphemeralPublicKey } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { useZkLoginSession } from "@/lib/zklogin/useZkLoginSession";

export type UnifiedSigner = {
  kind: "wallet" | "zklogin";
  address: string;
  signAndExecute: (tx: Transaction) => Promise<{ digest: string }>;
  logout?: () => void;
};

export function useSigner(): UnifiedSigner | null {
  const wallet = useWallet();
  const client = useSuiClient();
  const zk = useZkLoginSession();

  return useMemo(() => {
    const session = zk ?? loadZkLoginSession();
    if (session?.address) {
      // Ephemeral secret seed can be stored in the persisted session (preferred) or sessionStorage (back-compat).
      const secret =
        session.ephemeralSecretKeySeedB64 ||
        (typeof window !== "undefined"
          ? window.sessionStorage.getItem("fanfunding:zklogin-ephemeral-secret:v1")
          : null);
      const secretStable =
        secret ||
        (typeof window !== "undefined"
          ? window.localStorage.getItem("fanfunding:zklogin-ephemeral-secret-seed:v1")
          : null);

      if (!secretStable || !session.ephemeralPublicKey) {
        // Don't clear session — keep the address card visible.
        // Signing will fail with a clear message if attempted.
        return {
          kind: "zklogin" as const,
          address: session.address,
          signAndExecute: async (tx: any) => {
            console.warn("[useSigner] zkLogin session missing signing material.");
            throw new Error("Walletless signing unavailable—please sign in again.");
          },
          logout: () => {
            clearZkLoginSession();
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem("fanfunding:zklogin-ephemeral-secret:v1");
              window.localStorage.removeItem("fanfunding:zklogin-ephemeral-secret-seed:v1");
            }
          },
        };
      }

      // Validate the secret key reconstructs the correct keypair.
      // The secret is stored as a bech32 "suiprivkey1..." string.
      try {
        const keypair = Ed25519Keypair.fromSecretKey(secretStable);
        const derived = getExtendedEphemeralPublicKey(keypair.getPublicKey());
        if (derived !== session.ephemeralPublicKey) {
          // True corruption/mismatch: clear everything.
          clearAllZkLoginState();
          return null;
        }
      } catch (err) {
        console.warn("[useSigner] Clearing stale zkLogin session due to key reconstruction error", err);
        clearAllZkLoginState();
        return null;
      }

      const signer = new ZkLoginSigner(client as any, {
        address: session.address,
        jwt: session.jwt,
        maxEpoch: session.maxEpoch,
        addressSeed: session.addressSeed!,
        zkProof: session.zkProof as any,
        ephemeralSecretKey: secretStable,
        ephemeralPublicKey: session.ephemeralPublicKey,
      });

      return {
        kind: "zklogin" as const,
        address: session.address,
        signAndExecute: (tx: Transaction) => signer.signAndExecuteTransaction(tx),
        logout: () => {
          clearZkLoginSession();
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("fanfunding:zklogin-ephemeral-secret:v1");
            window.localStorage.removeItem("fanfunding:zklogin-ephemeral-secret-seed:v1");
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
  }, [wallet.connected, wallet.address, wallet.signAndExecuteTransaction, client, zk]);
}
