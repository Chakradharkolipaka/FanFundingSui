"use client";

import ConnectWallet from "@/components/ConnectWallet";
import { ThemeToggle } from "@/components/theme-toggle";
import AuthModal from "@/components/auth/AuthModal";
import UserProfileMenu from "@/components/auth/UserProfileMenu";
import Link from "next/link";
import { Home, PlusCircle } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex sticky top-0 z-40 border-b bg-background/80 backdrop-blur transition-all duration-300">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 transition-transform duration-200 hover:scale-105">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background text-sm font-bold">
              FF
            </span>
            <span className="flex flex-col">
              <span className="text-sm font-semibold leading-tight">Fan Funding</span>
              <span className="text-xs text-muted-foreground leading-tight">
                Sui • Support creators on-chain
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out hover:bg-accent hover:text-accent-foreground hover:scale-105 ${
                pathname === "/" ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
            <Link
              href="/mint"
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-in-out hover:bg-accent hover:text-accent-foreground hover:scale-105 ${
                pathname === "/mint" ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <PlusCircle className="h-4 w-4" />
              <span>Mint NFT</span>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <UserProfileMenu />
          <AuthModal />
          <ConnectWallet />
        </div>
      </div>
    </nav>
  );
}
