"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiClient } from "@mysten/sui/client";

// ─── Context Types ─────────────────────────────────────────────────

interface WalletContextType {
  address: string | null;
  connected: boolean;
  suiClient: SuiClient | null;
  signAndExecuteTransaction: (
    tx: Transaction
  ) => Promise<{ digest: string }>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  suiClient: null,
  signAndExecuteTransaction: async () => ({ digest: "" }),
});

// ─── Provider ──────────────────────────────────────────────────────

export function SuiWalletProvider({ children }: { children: ReactNode }) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();

  const address = account?.address ?? null;
  const connected = !!account;

  const signAndExecuteTransaction = async (
    tx: Transaction
  ): Promise<{ digest: string }> => {
    if (!account) throw new Error("Wallet not connected");

    console.log("[Sui Wallet] Signing and executing transaction...");
    const result = await signAndExecute({
      transaction: tx,
      chain: "sui:testnet",
    });
    console.log("[Sui Wallet] Transaction executed, digest:", result.digest);
    return { digest: result.digest };
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        connected,
        suiClient: client as unknown as SuiClient,
        signAndExecuteTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useWallet() {
  return useContext(WalletContext);
}
