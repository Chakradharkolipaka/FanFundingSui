"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { ConnectButton, useSuiClient } from "@mysten/dapp-kit";
import { initZkLogin, exportEphemeralKeypairSecret } from "@/lib/zklogin/zkLoginClient";
import { saveZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { decodeJwt } from "jose";
import { useToast } from "@/components/ui/use-toast";
import {
  jwtToAddress,
} from "@mysten/sui/zklogin";

type Props = {
  trigger?: React.ReactNode;
};

export default function AuthModal({ trigger }: Props) {
  const client = useSuiClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState<string | null>(null);
  const [pendingInit, setPendingInit] = useState(false);

  // Initialize nonce when modal opens so we can include it in the Google sign-in.
  // With GIS, nonce claim isn't automatically present unless you configure it in the request;
  // we still bind nonce via prover inputs and can optionally validate it in the JWT.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!open) return;
      setPendingInit(true);
      try {
        const init = await initZkLogin(client as any);
        if (cancelled) return;

        // Store ephemeral secret in sessionStorage (private material not persisted long-term)
        const secretB64 = exportEphemeralKeypairSecret(init.ephemeralKeypair);
        window.sessionStorage.setItem("fanfunding:zklogin-ephemeral-secret:v1", secretB64);

        // Stash init payload in memory for the next step.
        window.sessionStorage.setItem(
          "fanfunding:zklogin-init:v1",
          JSON.stringify({
            ephemeralPublicKey: init.ephemeralPublicKey,
            randomness: init.randomness,
            maxEpoch: init.maxEpoch,
          })
        );
        setNonce(init.nonce);
      } catch (e: any) {
        console.error(e);
        toast({ title: "zkLogin init failed", description: e?.message ?? String(e), variant: "destructive" });
      } finally {
        setPendingInit(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [open, client, toast]);

  const handleJwt = useCallback(
    async (jwt: string) => {
      try {
        const initRaw = window.sessionStorage.getItem("fanfunding:zklogin-init:v1");
        if (!initRaw) throw new Error("Missing zkLogin init data. Close and re-open auth modal.");
        const init = JSON.parse(initRaw) as {
          ephemeralPublicKey: string;
          randomness: string;
          maxEpoch: number;
        };

        // Light parsing for UI/session expiration.
        const decoded: any = decodeJwt(jwt);
        const jwtExp = typeof decoded?.exp === "number" ? decoded.exp : undefined;

        // Ask server to produce proof + addressSeed.
        const resp = await fetch("/api/zklogin/proof", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jwt,
            ephemeralPublicKey: init.ephemeralPublicKey,
            randomness: init.randomness,
            maxEpoch: init.maxEpoch,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Prover failed (${resp.status})`);
        }

        const { zkProof, addressSeed } = (await resp.json()) as any;

  // Derive address client-side.
  // The helper handles extracting iss/sub/aud from JWT and computing the address.
  const address = jwtToAddress(jwt, BigInt(addressSeed));

        saveZkLoginSession({
          provider: "google",
          jwt,
          jwtExp,
          maxEpoch: init.maxEpoch,
          randomness: init.randomness,
          nonce: nonce ?? undefined,
          address,
          addressSeed: String(addressSeed),
          zkProof,
          email: decoded?.email,
          picture: decoded?.picture,
        } as any);

        toast({ title: "Signed in with Google", description: `zkLogin address: ${address.slice(0, 10)}…` });
        setOpen(false);
      } catch (e: any) {
        console.error(e);
        toast({ title: "Google login failed", description: e?.message ?? String(e), variant: "destructive" });
      }
    },
    [nonce, toast]
  );

  const triggerNode = useMemo(() => {
    return trigger ?? (
      <Button variant="outline">Sign in</Button>
    );
  }, [trigger]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Google (zkLogin)</div>
            <div className="text-xs text-muted-foreground">Sign in with Google to get a Sui address without a wallet extension.</div>
            <div className="mt-3">
              <GoogleLoginButton onJwt={handleJwt} disabled={pendingInit || !nonce} nonce={nonce ?? undefined} />
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="text-sm font-medium">Sui Wallet</div>
            <div className="text-xs text-muted-foreground">Use your existing wallet extension.</div>
            <div className="mt-3">
              <ConnectButton />
            </div>
          </div>

          {nonce ? (
            <p className="text-[11px] text-muted-foreground break-all">
              zkLogin nonce (debug): {nonce}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
