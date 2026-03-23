"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import GoogleLoginButton from "@/components/auth/GoogleLoginButton";
import { ConnectButton, useSuiClient } from "@mysten/dapp-kit";
import { initZkLogin, exportEphemeralKeypairSecret } from "@/lib/zklogin/zkLoginClient";
import { clearAllZkLoginState, saveZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { loadZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { decodeJwt } from "jose";
import { useToast } from "@/components/ui/use-toast";
import {
  computeZkLoginAddressFromSeed,
  getExtendedEphemeralPublicKey,
} from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

type Props = {
  trigger?: React.ReactNode;
};

export default function AuthModal({ trigger }: Props) {
  const client = useSuiClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [nonce, setNonce] = useState<string | null>(null);
  const [pendingInit, setPendingInit] = useState(false);

  function readInitFromSessionStorage(): {
    ephemeralPublicKey: string;
    ephemeralPublicKeySuiB64?: string;
    randomness: string;
    maxEpoch: number;
    nonce?: string;
  } | null {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem("fanfunding:zklogin-init:v1");
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // Initialize nonce when modal opens so we can include it in the Google sign-in.
  // With GIS, nonce claim isn't automatically present unless you configure it in the request;
  // we still bind nonce via prover inputs and can optionally validate it in the JWT.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!open) return;

      // Reuse existing in-tab init (nonce/randomness/maxEpoch/epk) if present.
      // This prevents "nonce mismatch" caused by regenerating init while GIS popup may still be using prior nonce.
      const existingInit = readInitFromSessionStorage();
      setNonce((prev) => (prev ?? (existingInit?.nonce && typeof existingInit.nonce === "string" ? existingInit.nonce : null)));
      if (existingInit?.ephemeralPublicKey && existingInit?.randomness && existingInit?.maxEpoch) {
        return;
      }

      // Clean target design: if a valid zkLogin session already exists, don't generate new init material.
      // Re-initializing would create a new ephemeral keypair and can desync proof/seed/signature.
      const existing = loadZkLoginSession();
      if (existing?.address && existing?.jwt) {
        // If the session is missing critical signing material, DON'T clear it yet.
        // We will only clear on actual error, not just missing transient nonce/init.
        // The session itself (address/jwt/proof) is valid; ephemeral seed can be recovered.
        if (!existing.ephemeralPublicKey || !existing.ephemeralSecretKeySeedB64) {
          // Session exists but signing material is missing (sessionStorage was cleared).
          // Try to recover from localStorage ephemeral seed before giving up.
          const storedSeed = window.localStorage.getItem("fanfunding:zklogin-ephemeral-secret-seed:v1");
          if (storedSeed) {
            // We can recover! Don't re-init, just return.
            return;
          }
          // Truly unrecoverable: seed was never saved, or both were cleared.
          // Only now do we clear, and user will see "Please sign in again" when they try to mint/donate.
          clearAllZkLoginState();
        } else {
          // Session is complete; don't re-init.
          return;
        }
      }

      setPendingInit(true);
      try {
        const init = await initZkLogin(client as any);
        if (cancelled) return;

        // Store ephemeral secret key (bech32 "suiprivkey1..." string).
        // Ed25519Keypair.fromSecretKey() accepts this format directly for perfect roundtrip.
        const secretKey = exportEphemeralKeypairSecret(init.ephemeralKeypair);
        window.sessionStorage.setItem("fanfunding:zklogin-ephemeral-secret:v1", secretKey);
        window.localStorage.setItem("fanfunding:zklogin-ephemeral-secret-seed:v1", secretKey);

        // Stash init payload in memory for the next step.
        window.sessionStorage.setItem(
          "fanfunding:zklogin-init:v1",
          JSON.stringify({
            ephemeralPublicKey: init.ephemeralPublicKey,
            ephemeralPublicKeySuiB64: init.ephemeralPublicKeySuiB64,
            randomness: init.randomness,
            maxEpoch: init.maxEpoch,
            nonce: init.nonce,
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
          ephemeralPublicKeySuiB64?: string;
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
            ephemeralPublicKeySuiB64: init.ephemeralPublicKeySuiB64,
            randomness: init.randomness,
            maxEpoch: init.maxEpoch,
          }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Prover failed (${resp.status})`);
        }

        const { zkProof, addressSeed } = (await resp.json()) as any;

        // Derive address from the prover's addressSeed + JWT issuer.
        // CRITICAL: The prover returns addressSeed = genAddressSeed(salt, "sub", sub, aud) — it is the
        // FINAL poseidon hash. We must use computeZkLoginAddressFromSeed(addressSeed, iss), NOT
        // jwtToAddress(jwt, addressSeed) — the latter treats its 2nd arg as a raw userSalt and would
        // call genAddressSeed() AGAIN, double-hashing and producing a WRONG address.
        const decoded_iss = decoded?.iss as string;
        if (!decoded_iss) {
          throw new Error("JWT missing 'iss' claim. Cannot derive zkLogin address.");
        }
        const address = computeZkLoginAddressFromSeed(BigInt(addressSeed), decoded_iss);

        const seedB64 =
          window.sessionStorage.getItem("fanfunding:zklogin-ephemeral-secret:v1") ||
          window.localStorage.getItem("fanfunding:zklogin-ephemeral-secret-seed:v1") ||
          undefined;

        // --- Self-healing guard ---
        // If the ephemeral secret isn't present, we can't sign transactions.
        if (!seedB64) {
          clearAllZkLoginState();
          throw new Error("zkLogin session incomplete. Please sign in again.");
        }

        // Defensive: make sure address derivation is stable.
        const normalized = String(address).toLowerCase();
        if (!normalized.startsWith("0x") || normalized.length < 10) {
          clearAllZkLoginState();
          throw new Error("zkLogin address derivation failed. Please sign in again.");
        }

        // Validate the secret key produces the right keypair before saving
        try {
          const testKeypair = Ed25519Keypair.fromSecretKey(seedB64);
          const derivedPubkey = getExtendedEphemeralPublicKey(testKeypair.getPublicKey());
          if (derivedPubkey !== init.ephemeralPublicKey) {
            clearAllZkLoginState();
            throw new Error("Ephemeral key mismatch after login. Please sign in again.");
          }
        } catch (e: any) {
          if (e.message?.includes("mismatch")) throw e;
          clearAllZkLoginState();
          throw new Error("Failed to validate ephemeral key. Please sign in again.");
        }

        saveZkLoginSession({
          provider: "google",
          jwt,
          jwtExp,
          maxEpoch: init.maxEpoch,
          randomness: init.randomness,
          nonce: nonce ?? undefined,
          ephemeralPublicKey: init.ephemeralPublicKey,
          ephemeralPublicKeySuiB64: init.ephemeralPublicKeySuiB64,
          address,
          addressSeed: String(addressSeed),
          zkProof,
          ephemeralSecretKeySeedB64: seedB64,
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
