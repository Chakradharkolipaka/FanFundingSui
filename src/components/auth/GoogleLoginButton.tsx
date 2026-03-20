"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    google?: any;
  }
}

type Props = {
  onJwt: (jwt: string) => void | Promise<void>;
  disabled?: boolean;
  nonce?: string;
};

function loadGoogleIdentityScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("Not in browser"));

    // Already loaded
    if (window.google?.accounts?.id) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

export default function GoogleLoginButton({ onJwt, disabled, nonce }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const btnDivRef = useRef<HTMLDivElement | null>(null);

  const canUseGoogle = useMemo(() => {
    return Boolean(clientId && clientId.length > 10);
  }, [clientId]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!canUseGoogle) return;

      try {
        await loadGoogleIdentityScript();
        if (cancelled) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp: { credential?: string }) => {
            const jwt = resp?.credential;
            if (!jwt) return;
            setLoading(true);
            try {
              await onJwt(jwt);
            } finally {
              setLoading(false);
            }
          },
          // We use popup explicitly to avoid full page redirect.
          ux_mode: "popup",
          // Important for zkLogin: ensure the resulting JWT includes the nonce claim.
          // Enoki may validate `aud` + `nonce` binding.
          nonce: nonce || undefined,
        });

        // Render the Google branded button into our container.
        if (btnDivRef.current) {
          btnDivRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(btnDivRef.current, {
            theme: "outline",
            size: "large",
            shape: "pill",
            text: "signin_with",
            width: 280,
          });
        }

        setReady(true);
      } catch (e) {
        console.warn("[GoogleLoginButton]", e);
        setReady(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [canUseGoogle, clientId, onJwt, nonce]);

  if (!canUseGoogle) {
    return (
      <Button variant="secondary" className="w-full" disabled>
        Google login unavailable (missing NEXT_PUBLIC_GOOGLE_CLIENT_ID)
      </Button>
    );
  }

  // If GIS button couldn't be rendered (script blocked), fall back to a normal button that triggers prompt().
  const fallback = (
    <Button
      className="w-full"
      variant="outline"
      disabled={disabled || loading}
      onClick={() => {
        if (!window.google?.accounts?.id) return;
        window.google.accounts.id.prompt();
      }}
    >
      {loading ? "Signing in…" : "Sign in with Google"}
    </Button>
  );

  return (
    <div className="w-full space-y-2">
      <div
        ref={btnDivRef}
        className={"flex w-full justify-center"}
        aria-hidden={!ready}
      />
      {!ready ? fallback : null}
    </div>
  );
}
