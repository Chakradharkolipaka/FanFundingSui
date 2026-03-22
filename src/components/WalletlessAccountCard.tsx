"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useZkLoginSession } from "@/lib/zklogin/useZkLoginSession";

function short(addr: string) {
  if (addr.length < 16) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

type Props = {
  /** If true, hides this card when a wallet extension is connected. */
  hideWhenWalletConnected?: boolean;
};

export default function WalletlessAccountCard({ hideWhenWalletConnected = false }: Props) {
  const zk = useZkLoginSession();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const faucetUrl = useMemo(() => {
    // Reliable faucet entry-point for most users.
    // (Sui Discord has the testnet faucet channel.)
    return "https://discord.gg/sui";
  }, []);

  if (!zk?.address) return null;

  // Caller may hide this card if a wallet is connected, but we keep this logic
  // outside to avoid importing wallet hooks here (keeps this component reusable).
  if (hideWhenWalletConnected) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-cyan-500/5 to-teal-500/5">
      <CardHeader>
        <CardTitle>Walletless account (Google zkLogin)</CardTitle>
        <CardDescription>
          You’re signed in with Google. This is your derived Sui address (testnet). You can copy it and
          request faucet tokens.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border bg-background/60 p-3">
          <div className="text-xs text-muted-foreground">Address</div>
          <div className="mt-1 font-mono text-sm break-all">{zk.address}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{short(zk.address)}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(zk.address);
              setCopied(true);
              toast({ title: "Copied", description: "Walletless account address copied." });
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "Copied" : "Copy address"}
          </Button>

          <Button
            variant="secondary"
            onClick={() => window.open(faucetUrl, "_blank", "noopener,noreferrer")}
          >
            Open faucet
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          {zk.email ? (
            <span>
              Logged in as <span className="font-medium">{zk.email}</span>
            </span>
          ) : (
            <span>Logged in with Google</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
