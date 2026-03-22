"use client";

import { useMemo } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import type { Transaction } from "@mysten/sui/transactions";
import { useWallet } from "@/lib/wallet";
import { loadZkLoginSession, clearZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { ZkLoginSigner } from "@/lib/zklogin/zkLoginSigner";

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

      if (!secret) {
        // Can't sign without ephemeral secret. Don't auto-clear the session here because it makes UX confusing
        // (user just signed in). Instead, return null and let UI prompt re-login.
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
