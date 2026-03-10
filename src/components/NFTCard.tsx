"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import Confetti from "react-confetti";
import { Loader2, ExternalLink } from "lucide-react";
import { useDonate } from "@/hooks/useDonate";
import {
  shortenAddress,
  formatEth,
  parseEth,
  explorerTxUrl,
  explorerAccountUrl,
  explorerObjectUrl,
} from "@/lib/sui-utils";
import { DONATION_TOKEN_SYMBOL } from "@/constants";

import type { NftData } from "@/hooks/useNFTs";

interface NFTCardProps {
  nft: NftData;
  onDonation?: (payload: { donor: string; amount: bigint; tokenId: number }) => void;
  onTotalsChange?: () => void;
}

export default function NFTCard({ nft, onDonation, onTotalsChange }: NFTCardProps) {
  const { tokenId, objectId, metadata, owner, totalDonations } = nft;
  const [donationAmount, setDonationAmount] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast } = useToast();
  const { donate, isLoading: isDonating, isConfirmed, txHash } = useDonate();

  useEffect(() => {
    if (isConfirmed) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5000);
      setDonationAmount("");
      onTotalsChange?.();
    }
  }, [isConfirmed, onTotalsChange]);

  const handleDonate = () => {
    if (!donationAmount || parseFloat(donationAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: `Please enter a valid donation amount in ${DONATION_TOKEN_SYMBOL}.`,
        variant: "destructive",
      });
      return;
    }

    if (!objectId) {
      toast({
        title: "Error",
        description: "NFT object ID not found. Cannot donate.",
        variant: "destructive",
      });
      return;
    }

    try {
      const amountMist = parseEth(donationAmount);
      console.log("[NFTCard] Donating", donationAmount, DONATION_TOKEN_SYMBOL, "=", amountMist.toString(), "MIST to object:", objectId);
      donate(objectId, amountMist);
    } catch {
      toast({
        title: "Invalid Amount",
        description: "Could not parse the donation amount. Please enter a valid number.",
        variant: "destructive",
      });
    }
  };

  const computedTotalDonations = totalDonations ?? 0n;

  return (
    <>
      {showConfetti && <Confetti />}
      <Card className="overflow-hidden group transition-all duration-300 ease-in-out hover:scale-[1.03] hover:shadow-xl hover:shadow-primary/10 dark:hover:shadow-primary/5 border-transparent hover:border-primary/20">
        <CardHeader className="p-0">
          <div className="relative w-full h-64 overflow-hidden">
            {metadata?.image ? (
              <Image
                src={metadata.image}
                alt={metadata.name || ""}
                fill
                className="object-cover transition-transform duration-500 ease-in-out group-hover:scale-110"
              />
            ) : (
              <div className="w-full h-full bg-secondary rounded-t-lg animate-pulse"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2 transition-colors duration-200">
          <CardTitle className="group-hover:text-primary transition-colors duration-200">
            {metadata?.name || `NFT #${tokenId}`}
          </CardTitle>
          <p className="text-sm text-muted-foreground truncate">{metadata?.description}</p>
          {typeof owner === "string" && owner && (
            <a
              href={explorerAccountUrl(owner)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-1"
            >
              Creator: {shortenAddress(owner)} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {objectId && (
            <a
              href={explorerObjectUrl(objectId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors duration-200 flex items-center gap-1"
            >
              Object: {shortenAddress(objectId)} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </CardContent>
        <CardFooter className="flex justify-between items-center p-4 bg-muted/50 transition-colors duration-200 group-hover:bg-muted/70">
          <div>
            <p className="text-sm font-bold">{`${formatEth(computedTotalDonations)} ${DONATION_TOKEN_SYMBOL}`}</p>
            <p className="text-xs text-muted-foreground">Total Fan Donations</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                disabled={isDonating}
                className="transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-md"
              >
                Fan Donate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fan Donate to {metadata?.name || `NFT #${tokenId}`}</DialogTitle>
                <DialogDescription>
                  Your support helps the creator. Enter the amount of {DONATION_TOKEN_SYMBOL} you&apos;d like to donate.
                  <br />
                  <span className="text-xs mt-1 block">
                    💡 On Sui, this sends a native SUI transfer via the smart contract.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Input
                    type="number"
                    placeholder="0.1"
                    step="0.01"
                    min="0"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
                    disabled={isDonating}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Amount in {DONATION_TOKEN_SYMBOL} (e.g. 0.1 = 100,000,000 MIST)
                  </p>
                </div>
                <Button
                  onClick={handleDonate}
                  disabled={isDonating}
                  className="w-full transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md"
                >
                  {isDonating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    "Confirm Fan Donation"
                  )}
                </Button>
                {txHash && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>
                      Tx:{" "}
                      <a
                        href={explorerTxUrl(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {txHash.slice(0, 12)}...{txHash.slice(-6)}
                      </a>
                    </p>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <h4 className="text-xs font-semibold text-muted-foreground">💧 Need testnet SUI?</h4>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href="https://discord.gg/sui"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Discord Faucet ↗
                    </a>
                    <span className="text-xs text-muted-foreground">
                      or run: <code className="font-mono">sui client faucet</code>
                    </span>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardFooter>
      </Card>
    </>
  );
}
