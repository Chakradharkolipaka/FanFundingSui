"use client";

import { useState, useCallback } from "react";
import { PACKAGE_ID, MODULE_NAME, COLLECTION_ID, SUI_NODE_URL } from "@/constants";
import { useToast } from "@/components/ui/use-toast";
import { Transaction } from "@mysten/sui/transactions";
import { SuiClient } from "@mysten/sui/client";
import { useSigner } from "@/hooks/useSigner";

/**
 * Hook for minting an NFT on Sui.
 * 1. Uploads image + metadata to IPFS via API route
 * 2. Builds a Sui Transaction and signs via connected wallet
 * 3. Waits for transaction confirmation
 */
export function useMintNFT() {
  const signer = useSigner();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const mint = useCallback(
    async (file: File, name: string, description: string) => {
      if (!signer?.address) {
        toast({
          title: "Not Signed In",
          description: "Please sign in with Google (zkLogin) or connect your Sui wallet.",
          variant: "destructive",
        });
        return;
      }

      if (!PACKAGE_ID) {
        toast({
          title: "Configuration Error",
          description: "Package ID is not configured. Set NEXT_PUBLIC_PACKAGE_ID in .env.local.",
          variant: "destructive",
        });
        return;
      }

      if (!COLLECTION_ID) {
        toast({
          title: "Configuration Error",
          description: "Collection ID is not configured. Set NEXT_PUBLIC_COLLECTION_ID in .env.local.",
          variant: "destructive",
        });
        return;
      }

      try {
        setIsConfirmed(false);
        setTxHash(null);

        // ── Step 1: Upload to IPFS ──
        setIsUploading(true);
        toast({
          title: "📤 Step 1/3: Uploading to IPFS...",
          description: "Uploading your image and metadata to decentralized storage.",
        });
        console.log("[Mint] Step 1: Starting IPFS upload...");

        const formData = new FormData();
        formData.append("file", file);
        formData.append("name", name);
        formData.append("description", description);

        const uploadRes = await fetch("/api/pinata/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(errData.error || `Upload failed (${uploadRes.status})`);
        }

        const { tokenURI } = await uploadRes.json();
        if (!tokenURI) throw new Error("No token URI returned from IPFS upload");

        setIsUploading(false);
        console.log("[Mint] Step 1 complete. Token URI:", tokenURI);
        toast({
          title: "✅ Step 1/3: Upload Complete",
          description: `Metadata stored on IPFS. Token URI: ${tokenURI.slice(0, 40)}...`,
        });

        // ── Step 2: Build and sign Sui transaction ──
        setIsMinting(true);
        toast({
          title: "🔐 Step 2/3: Confirm in Wallet",
          description: "Please approve the mint transaction in your Sui wallet.",
        });
        console.log("[Mint] Step 2: Building Sui transaction...");
        console.log("[Mint] Package ID:", PACKAGE_ID);
        console.log("[Mint] Collection ID:", COLLECTION_ID);

        const encoder = new TextEncoder();
        const tx = new Transaction();

        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::mint_nft`,
          arguments: [
            tx.object(COLLECTION_ID),
            tx.pure.vector("u8", Array.from(encoder.encode(name))),
            tx.pure.vector("u8", Array.from(encoder.encode(description))),
            tx.pure.vector("u8", Array.from(encoder.encode(tokenURI))),
          ],
        });

        console.log("[Mint] Transaction built, requesting wallet signature...");
  const response = await signer.signAndExecute(tx);
        const digest = response.digest;

        setTxHash(digest);
        setIsMinting(false);
        console.log("[Mint] Step 2 complete. Tx Digest:", digest);

        // ── Step 3: Wait for confirmation ──
        setIsConfirming(true);
        toast({
          title: "⏳ Step 3/3: Waiting for Confirmation...",
          description: `Tx: ${digest.slice(0, 12)}... Confirming on Sui.`,
        });
        console.log("[Mint] Step 3: Waiting for transaction confirmation...");

        const client = new SuiClient({ url: SUI_NODE_URL });
        let confirmed = false;

        for (let i = 0; i < 30; i++) {
          try {
            const txResult = await client.waitForTransaction({
              digest,
              options: { showEffects: true },
            });
            if (txResult.effects?.status?.status === "success") {
              confirmed = true;
              console.log("[Mint] Transaction confirmed successfully!");
              break;
            } else if (txResult.effects?.status?.status === "failure") {
              console.error("[Mint] Transaction failed:", txResult.effects.status.error);
              break;
            }
          } catch (e) {
            console.log(`[Mint] Waiting... attempt ${i + 1}/30`);
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        setIsConfirmed(confirmed);
        toast({
          title: confirmed ? "🎉 NFT Minted Successfully!" : "⚠️ Transaction may still be pending",
          description: confirmed
            ? "Your NFT is now live on Sui. View it on the home page!"
            : "Check the explorer for final status.",
        });
        console.log("[Mint] Final status:", confirmed ? "CONFIRMED" : "PENDING");
      } catch (err: any) {
        console.error("[Mint] Error:", err);
        const msg = err?.message || String(err);
        if (msg.includes("User") || msg.includes("rejected") || msg.includes("Rejected")) {
          toast({
            title: "Transaction Rejected",
            description: "You rejected the transaction in your wallet.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Minting Failed",
            description: msg.slice(0, 200),
            variant: "destructive",
          });
        }
      } finally {
        setIsUploading(false);
        setIsMinting(false);
        setIsConfirming(false);
      }
    },
    [signer, toast]
  );

  const isProcessing = isUploading || isMinting || isConfirming;

  return { mint, isUploading, isMinting, isConfirming, isConfirmed, isProcessing, txHash };
}
