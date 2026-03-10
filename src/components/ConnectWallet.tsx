"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Wallet, LogOut, ExternalLink, Copy, Check } from "lucide-react";
import { shortenAddress } from "@/lib/sui-utils";
import {
  useConnectWallet,
  useDisconnectWallet,
  useWallets,
} from "@mysten/dapp-kit";

export default function ConnectWallet() {
  const { address, connected } = useWallet();
  const wallets = useWallets();
  const { mutate: connectWallet } = useConnectWallet();
  const { mutate: disconnectWallet } = useDisconnectWallet();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = (wallet: any) => {
    try {
      toast({
        title: "Connecting Wallet...",
        description: `Connecting via ${wallet.name}. Please approve in your wallet.`,
      });
      connectWallet(
        { wallet },
        {
          onSuccess: () => {
            setOpen(false);
            toast({
              title: "Wallet Connected",
              description: "Your Sui wallet is now connected!",
            });
          },
          onError: (err: any) => {
            toast({
              title: "Connection Failed",
              description: err?.message || "Failed to connect wallet.",
              variant: "destructive",
            });
          },
        }
      );
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err?.message || "Failed to connect wallet.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const handleCopyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyAddress}
          className="font-mono text-xs transition-all duration-200 ease-in-out hover:scale-105 hover:shadow-md"
        >
          {copied ? (
            <Check className="h-3 w-3 mr-1" />
          ) : (
            <Copy className="h-3 w-3 mr-1" />
          )}
          {shortenAddress(address)}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisconnect}
          className="transition-all duration-200 ease-in-out hover:scale-105 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-lg"
          size="sm"
        >
          <Wallet className="h-4 w-4 mr-2" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect Sui Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to the Sui network.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-4">
          {wallets.length > 0 ? (
            wallets.map((wallet) => (
              <Button
                key={wallet.name}
                variant="outline"
                className="w-full justify-start gap-3 h-14 text-left transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-md hover:border-primary/50"
                onClick={() => handleConnect(wallet)}
              >
                <span className="text-2xl">&#128167;</span>
                <div className="flex flex-col">
                  <span className="font-medium">{wallet.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Click to connect
                  </span>
                </div>
              </Button>
            ))
          ) : (
            <div className="text-center py-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                No Sui wallets detected.
              </p>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-14 text-left transition-all duration-200"
                onClick={() =>
                  window.open("https://suiwallet.com/", "_blank")
                }
              >
                <span className="text-2xl">&#128167;</span>
                <div className="flex flex-col">
                  <span className="font-medium">Install Sui Wallet</span>
                  <span className="text-xs text-muted-foreground">
                    Opens suiwallet.com in a new tab
                  </span>
                </div>
              </Button>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border bg-muted/50 p-4 space-y-2">
          <h4 className="text-sm font-semibold">Supported Wallets</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Sui Wallet</span>
              <a
                href="https://suiwallet.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Install <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span>Suiet Wallet</span>
              <a
                href="https://suiet.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Install <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <h4 className="text-sm font-semibold pt-2">Sui Testnet Faucets</h4>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Discord Faucet</span>
              <a
                href="https://discord.gg/sui"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Get SUI <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center justify-between">
              <span>CLI Faucet</span>
              <span className="text-xs font-mono">sui client faucet</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
