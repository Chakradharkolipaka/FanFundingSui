"use client";

import AuthModal from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { clearAllZkLoginState } from "@/lib/zklogin/zkLoginSession";
import { useZkLoginSession } from "@/lib/zklogin/useZkLoginSession";

/**
 * Navbar auth button that toggles between:
 * - Sign in (opens AuthModal)
 * - Sign out (clears zkLogin session)
 *
 * Wallet-extension connect/disconnect remains handled by ConnectWallet.
 */
export default function AuthButton() {
  const zk = useZkLoginSession();

  if (!zk?.address) {
    return <AuthModal />;
  }

  return (
    <Button
      variant="outline"
      onClick={() => {
        clearAllZkLoginState();
      }}
    >
      Sign out
    </Button>
  );
}
