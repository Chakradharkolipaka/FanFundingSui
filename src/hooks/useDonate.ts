"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { PACKAGE_ID, MODULE_NAME, DONATION_TOKEN_SYMBOL, SUI_NODE_URL } from "@/constants";
import { useToast } from "@/components/ui/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";

/**
 * Hook for donating SUI to an NFT creator on Sui.
 * Uses the connected Sui wallet to sign & submit a coin split + moveCall transaction.
 *
 * On Sui, we split the gas coin to create a payment Coin<SUI>, then pass
 * it to the donate function which transfers it to the NFT creator.
 */
export function useDonate() {
  const { signAndExecuteTransaction, connected } = useWallet();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  /**
   * @param tokenObjectId - The Sui object ID of the FanToken to donate to
   * @param amountMist - Amount in MIST (1 SUI = 10^9 MIST)
   */
  const donate = useCallback(
    async (tokenObjectId: string, amountMist: bigint) => {
      if (!connected) {
        toast({
          title: "Wallet Not Connected",
          description: "Please connect your Sui wallet.",
          variant: "destructive",
        });
        return;
      }
      if (!PACKAGE_ID) {
        toast({
          title: "Configuration Error",
          description: "Package ID is not set. Set NEXT_PUBLIC_PACKAGE_ID in .env.local.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsLoading(true);
        setIsConfirmed(false);
        setTxHash(null);

        toast({
          title: "🔐 Step 1/2: Confirm in Wallet",
          description: `Please approve the ${DONATION_TOKEN_SYMBOL} donation in your Sui wallet.`,
        });
        console.log("[Donate] Building transaction...");
        console.log("[Donate] Token Object ID:", tokenObjectId);
        console.log("[Donate] Amount (MIST):", amountMist.toString());

        const tx = new Transaction();

        // Split gas coin to create a Coin<SUI> with the donation amount
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountMist)]);

        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::donate`,
          arguments: [
            tx.object(tokenObjectId),
            coin,
          ],
        });

        console.log("[Donate] Requesting wallet signature...");
        const response = await signAndExecuteTransaction(tx);
        const digest = response.digest;

        setTxHash(digest);
        console.log("[Donate] Transaction submitted. Digest:", digest);

        toast({
          title: "⏳ Step 2/2: Transaction Submitted",
          description: `Tx: ${digest.slice(0, 12)}... Waiting for confirmation.`,
        });

        // Wait for confirmation
        const client = new SuiClient({ url: SUI_NODE_URL });
        let confirmed = false;

        try {
          const txResult = await client.waitForTransaction({
            digest,
            options: { showEffects: true },
          });
          confirmed = txResult.effects?.status?.status === "success";
          console.log("[Donate] Transaction status:", txResult.effects?.status?.status);
          if (!confirmed) {
            console.error("[Donate] Transaction failed:", txResult.effects?.status?.error);
          }
        } catch (e) {
          console.warn("[Donate] waitForTransaction failed, polling...");
          for (let i = 0; i < 20; i++) {
            try {
              const txResult = await client.getTransactionBlock({
                digest,
                options: { showEffects: true },
              });
              if (txResult.effects?.status?.status === "success") {
                confirmed = true;
                break;
              }
            } catch {
              // retry
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        setIsConfirmed(confirmed);
        toast({
          title: confirmed ? "✅ Donation Successful!" : "⚠️ Transaction may still be pending",
          description: confirmed
            ? "Thank you for supporting this creator on Sui!"
            : "Check the explorer for final status.",
        });
        console.log("[Donate] Final status:", confirmed ? "CONFIRMED" : "PENDING");
      } catch (err: any) {
        console.error("[Donate] Error:", err);
        const msg = err?.message || String(err);
        if (msg.includes("User") || msg.includes("rejected") || msg.includes("Rejected")) {
          toast({
            title: "Transaction Rejected",
            description: "You rejected the transaction in your wallet.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Donation Failed",
            description: msg.slice(0, 200),
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [connected, signAndExecuteTransaction, toast]
  );

  return { donate, isLoading, txHash, isConfirmed };
}
