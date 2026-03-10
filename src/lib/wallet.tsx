"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  getAptosWallets,
  type AptosWallet,
  AptosSignAndSubmitTransactionNamespace,
  AptosDisconnectNamespace,
  AptosGetAccountNamespace,
  AptosOnAccountChangeNamespace,
  UserResponseStatus,
} from "@aptos-labs/wallet-standard";

// ─── Context Types ─────────────────────────────────────────────────

interface WalletContextType {
  address: string | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signAndSubmitTransaction: (payload: any) => Promise<{ hash: string }>;
  isPetraInstalled: boolean;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  connected: false,
  connecting: false,
  connect: async () => {},
  disconnect: async () => {},
  signAndSubmitTransaction: async () => ({ hash: "" }),
  isPetraInstalled: false,
});

// ─── Helper: find Petra among registered AIP-62 wallets ────────────

function findPetra(wallets: readonly AptosWallet[]): AptosWallet | undefined {
  return wallets.find((w) => w.name.toLowerCase().includes("petra"));
}

// ─── Provider ──────────────────────────────────────────────────────

export function PetraWalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isPetraInstalled, setIsPetraInstalled] = useState(false);
  const walletRef = useRef<AptosWallet | null>(null);

  // Discover wallets via the AIP-62 Wallet Standard
  useEffect(() => {
    if (typeof window === "undefined") return;

    const { aptosWallets, on } = getAptosWallets();

    const checkWallets = (list: readonly AptosWallet[]) => {
      const petra = findPetra(list);
      if (petra) {
        setIsPetraInstalled(true);
        walletRef.current = petra;

        // Try silent reconnect
        const connectFeature = petra.features["aptos:connect"];
        if (connectFeature) {
          connectFeature
            .connect(true) // silent = true
            .then((response) => {
              if (response.status === UserResponseStatus.APPROVED) {
                const addr = response.args.address.toString();
                setAddress(addr);
                setConnected(true);
              }
            })
            .catch(() => {
              // Silent reconnect failed — that's fine
            });
        }

        // Listen for account changes
        const onAccountChange = petra.features["aptos:onAccountChange"];
        if (onAccountChange) {
          onAccountChange.onAccountChange((account) => {
            if (account) {
              setAddress(account.address.toString());
              setConnected(true);
            } else {
              setAddress(null);
              setConnected(false);
            }
          });
        }
      }
    };

    // Check already-registered wallets
    checkWallets(aptosWallets);

    // Listen for wallets registering later
    const unsubscribe = on("register", () => {
      const { aptosWallets: updated } = getAptosWallets();
      checkWallets(updated);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const connect = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) {
      window.open("https://petra.app/", "_blank");
      return;
    }

    const connectFeature = wallet.features["aptos:connect"];
    if (!connectFeature) throw new Error("Wallet does not support connect");

    try {
      setConnecting(true);
      const response = await connectFeature.connect();
      if (response.status === UserResponseStatus.APPROVED) {
        const addr = response.args.address.toString();
        setAddress(addr);
        setConnected(true);
      } else {
        throw new Error("Connection rejected by user");
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;

    const disconnectFeature = wallet.features[AptosDisconnectNamespace];
    if (disconnectFeature) {
      try {
        await disconnectFeature.disconnect();
      } catch (err) {
        console.error("Disconnect error:", err);
      }
    }
    setAddress(null);
    setConnected(false);
  }, []);

  /**
   * Sign and submit a transaction.
   * Accepts old-style { type, function, type_arguments, arguments } payloads
   * and converts them to the AIP-62 standard format.
   */
  const signAndSubmitTransaction = useCallback(
    async (payload: any): Promise<{ hash: string }> => {
      const wallet = walletRef.current;
      if (!wallet) throw new Error("Petra wallet not installed");
      if (!connected) throw new Error("Wallet not connected");

      const submitFeature = wallet.features[AptosSignAndSubmitTransactionNamespace];
      if (!submitFeature) {
        throw new Error("Wallet does not support signAndSubmitTransaction");
      }

      // Convert old-style entry_function_payload to AIP-62 format
      const standardPayload = {
        payload: {
          function: payload.function as `${string}::${string}::${string}`,
          typeArguments: payload.type_arguments ?? [],
          functionArguments: payload.arguments ?? [],
        },
      };

      const response = await submitFeature.signAndSubmitTransaction(standardPayload);

      if (response.status === UserResponseStatus.APPROVED) {
        return { hash: response.args.hash };
      } else {
        throw new Error("Transaction rejected by user");
      }
    },
    [connected]
  );

  return (
    <WalletContext.Provider
      value={{
        address,
        connected,
        connecting,
        connect,
        disconnect,
        signAndSubmitTransaction,
        isPetraInstalled,
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
