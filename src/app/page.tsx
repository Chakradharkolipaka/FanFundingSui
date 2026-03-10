"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import NFTCard from "@/components/NFTCard";
import SkeletonCard from "@/components/SkeletonCard";
import { Button } from "@/components/ui/button";
import { useNFTs } from "@/hooks/useNFTs";
import { formatEth, shortenAddress, explorerAccountUrl, explorerTxUrl, explorerObjectUrl } from "@/lib/sui-utils";
import { PACKAGE_ID, COLLECTION_ID, DONATION_TOKEN_SYMBOL, EXPLORER_BASE_URL } from "@/constants";
import { ExternalLink } from "lucide-react";

export default function Home() {
  const { nfts, totalSupply, isLoading, refetch } = useNFTs();
  const [hiddenTokenIds, setHiddenTokenIds] = useState<number[]>([]);

  const visibleNfts = useMemo(
    () => nfts.filter((nft) => !hiddenTokenIds.includes(nft.tokenId)),
    [nfts, hiddenTokenIds]
  );

  const topDonatedNfts = useMemo(
    () =>
      [...visibleNfts]
        .sort((a, b) => Number(b.totalDonations - a.totalDonations))
        .slice(0, 10),
    [visibleNfts]
  );

  const totalDonationsAll = useMemo(
    () => visibleNfts.reduce((sum, nft) => sum + (nft.totalDonations ?? 0n), 0n),
    [visibleNfts]
  );

  const topSupportedNames = useMemo(() => {
    if (topDonatedNfts.length === 0) return "No support yet";
    return topDonatedNfts
      .slice(0, 3)
      .map((nft) => nft.metadata?.name || `NFT #${nft.tokenId}`)
      .join(", ");
  }, [topDonatedNfts]);

  const handleTotalsChange = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleDonation = useCallback(
    (_payload: { donor: string; amount: bigint; tokenId: number }) => {
      refetch();
    },
    [refetch]
  );

  return (
    <main className="container mx-auto px-4 py-10 space-y-10">
      {/* ── Hero Section ── */}
      <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">
            Explore Impact NFTs
          </h1>
          <p className="text-muted-foreground max-w-xl text-sm md:text-base">
            Discover NFTs, support creators, and track the most supported drops — powered
            by <span className="font-semibold text-primary">Sui</span>.
          </p>
          {PACKAGE_ID && (
            <a
              href={explorerObjectUrl(PACKAGE_ID)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-primary transition-colors"
            >
              Package: {shortenAddress(PACKAGE_ID)} <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {COLLECTION_ID && (
            <a
              href={explorerObjectUrl(COLLECTION_ID)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-2 ml-4 hover:text-primary transition-colors"
            >
              Collection: {shortenAddress(COLLECTION_ID)} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 text-center text-sm">
          <div className="rounded-xl border bg-card dark:bg-gradient-to-br dark:from-slate-900/60 dark:to-slate-800/60 px-4 py-3 transition-all duration-300 hover:scale-105 hover:shadow-md">
            <p className="text-xs text-muted-foreground">NFTs</p>
            <p className="text-lg font-semibold">{visibleNfts.length}</p>
          </div>
          <div className="rounded-xl border bg-card dark:bg-gradient-to-br dark:from-slate-900/60 dark:to-emerald-900/40 px-4 py-3 transition-all duration-300 hover:scale-105 hover:shadow-md">
            <p className="text-xs text-muted-foreground">Total Donations</p>
            <p className="text-lg font-semibold">
              {nfts.length > 0 ? `${formatEth(totalDonationsAll)} ${DONATION_TOKEN_SYMBOL}` : `0 ${DONATION_TOKEN_SYMBOL}`}
            </p>
          </div>
          <div className="rounded-xl border bg-card dark:bg-gradient-to-br dark:from-slate-900/60 dark:to-indigo-900/40 px-4 py-3 transition-all duration-300 hover:scale-105 hover:shadow-md">
            <p className="text-xs text-muted-foreground">Top Supported</p>
            <p className="text-sm font-semibold truncate">{topSupportedNames}</p>
          </div>
        </div>
      </section>

      {/* ── Network Info Banner ── */}
      <section className="rounded-xl border bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-teal-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all duration-300 hover:shadow-lg">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
          <div>
            <p className="text-sm font-medium">Sui Testnet</p>
            <p className="text-xs text-muted-foreground">
              Wallet: Sui Wallet / Suiet / Ethos | Fee token: SUI
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <a
            href="https://discord.gg/sui"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1 rounded-full border bg-background hover:bg-accent transition-all duration-200 hover:scale-105"
          >
            💧 Get Testnet SUI
          </a>
          <a
            href="https://suiwallet.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1 rounded-full border bg-background hover:bg-accent transition-all duration-200 hover:scale-105"
          >
            💧 Sui Wallet
          </a>
          <a
            href="https://suiscan.xyz/testnet"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs px-3 py-1 rounded-full border bg-background hover:bg-accent transition-all duration-200 hover:scale-105"
          >
            🔍 Explorer
          </a>
        </div>
      </section>

      {/* ── Top Supported & Stats ── */}
      {visibleNfts.length > 0 && (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-card dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-800/80 p-6 transition-all duration-300 hover:shadow-lg">
            <h2 className="text-xl font-semibold mb-1">Top Supported NFTs</h2>
            <p className="text-sm text-muted-foreground mb-4">
              NFTs with the highest total fan donations.
            </p>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {topDonatedNfts.map((nft, index) => (
                <div
                  key={nft.tokenId}
                  className="flex items-center justify-between rounded-lg bg-background/60 p-3 transition-all duration-200 hover:bg-background/80 hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="text-sm font-semibold text-muted-foreground w-6 text-right">
                      #{index + 1}
                    </span>
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border">
                      {nft.metadata?.image && (
                        <Image
                          src={nft.metadata.image}
                          alt={nft.metadata.name || ""}
                          fill
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {nft.metadata?.name || `NFT #${nft.tokenId}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatEth(nft.totalDonations)} {DONATION_TOKEN_SYMBOL}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card dark:bg-gradient-to-br dark:from-slate-900/80 dark:to-slate-800/80 p-6 transition-all duration-300 hover:shadow-lg">
            <h2 className="text-xl font-semibold mb-1">About Sui</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Key info about the network powering this platform.
            </p>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-background/60 p-3">
                <span className="text-muted-foreground">Network</span>
                <span className="font-medium">Sui Testnet</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/60 p-3">
                <span className="text-muted-foreground">Consensus</span>
                <span className="font-medium">Mysticeti (DAG-based)</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/60 p-3">
                <span className="text-muted-foreground">Smart Contract</span>
                <span className="font-medium">Move Language (Object Model)</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/60 p-3">
                <span className="text-muted-foreground">Object Model</span>
                <span className="font-medium">Object-Centric (Shared Objects)</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/60 p-3">
                <span className="text-muted-foreground">Donation Method</span>
                <span className="font-medium">Native SUI Transfer via Contract</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-background/60 p-3">
                <span className="text-muted-foreground">Block Explorer</span>
                <a
                  href={EXPLORER_BASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline flex items-center gap-1"
                >
                  SuiScan <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── All NFTs Grid ── */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">All NFTs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : visibleNfts.length > 0 ? (
            visibleNfts.map((nft) => (
              <NFTCard
                key={nft.tokenId}
                nft={nft}
                onDonation={handleDonation}
                onTotalsChange={handleTotalsChange}
              />
            ))
          ) : (
            <div className="col-span-full text-center py-10">
              <p className="mb-4 text-muted-foreground">
                No NFTs found yet. Be the first to mint and support a cause on Sui.
              </p>
              <Button asChild className="transition-all duration-200 hover:scale-105 hover:shadow-lg">
                <Link href="/mint">Mint an NFT</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
