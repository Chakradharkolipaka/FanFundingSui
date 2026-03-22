"use client";

import { useMemo, useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { clearZkLoginSession, loadZkLoginSession } from "@/lib/zklogin/zkLoginSession";
import { useWallet } from "@/lib/wallet";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function UserProfileMenu() {
  const wallet = useWallet();
  const [open, setOpen] = useState(false);
  const zk = useMemo(() => loadZkLoginSession(), [open]);

  const address = wallet.connected ? wallet.address : zk?.address;
  const email = zk?.email;
  const picture = zk?.picture;

  if (!address) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 px-2">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt="avatar" className="h-7 w-7 rounded-full" />
          ) : (
            <div className="h-7 w-7 rounded-full bg-muted" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="text-sm">{email ?? (wallet.connected ? "Wallet" : "zkLogin")}</div>
          <div className="text-xs text-muted-foreground break-all">{shortAddr(address)}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(address);
          }}
        >
          Copy address
        </DropdownMenuItem>
        {zk ? (
          <DropdownMenuItem
            onClick={() => {
              clearZkLoginSession();
              if (typeof window !== "undefined") {
                window.sessionStorage.removeItem("fanfunding:zklogin-ephemeral-secret:v1");
                window.sessionStorage.removeItem("fanfunding:zklogin-init:v1");
              }
              setOpen(false);
            }}
          >
            Logout
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
