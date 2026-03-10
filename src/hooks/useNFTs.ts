"use client";

import { useState, useEffect, useCallback } from "react";
import { PACKAGE_ID, MODULE_NAME, COLLECTION_ID, SUI_NODE_URL } from "@/constants";
import { SuiClient } from "@mysten/sui/client";

export interface NftData {
  tokenId: number;
  objectId: string; // Sui object ID — needed for donate
  metadata: Record<string, any>;
  owner: string;
  totalDonations: bigint;
}

/**
 * Hook to fetch all NFTs from the Sui contract.
 *
 * On Sui, FanToken objects are shared objects created by the contract.
 * We query all objects of type `${PACKAGE_ID}::nft_donation::FanToken`
 * using the Sui RPC `queryEvents` (MintEvent) or `getOwnedObjects`.
 *
 * Since FanTokens are shared objects, we query MintEvents to discover
 * token object IDs, then fetch each object's fields.
 */
export function useNFTs() {
  const [nfts, setNfts] = useState<NftData[]>([]);
  const [totalSupply, setTotalSupply] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTs = useCallback(async () => {
    if (!PACKAGE_ID || !COLLECTION_ID) {
      console.warn("[useNFTs] PACKAGE_ID or COLLECTION_ID not set — skipping NFT fetch");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      console.log("[useNFTs] Fetching NFTs from Sui...");
      console.log("[useNFTs] Package ID:", PACKAGE_ID);
      console.log("[useNFTs] Collection ID:", COLLECTION_ID);

      const client = new SuiClient({ url: SUI_NODE_URL });

      // 1. Read the Collection shared object to get total supply
      const collectionObj = await client.getObject({
        id: COLLECTION_ID,
        options: { showContent: true },
      });

      if (!collectionObj.data?.content || collectionObj.data.content.dataType !== "moveObject") {
        throw new Error("Collection object not found or is not a Move object");
      }

      const collectionFields = (collectionObj.data.content as any).fields;
      const nextId = Number(collectionFields.next_id);
      const supply = nextId - 1;
      setTotalSupply(supply);
      console.log("[useNFTs] Total supply:", supply);

      if (supply === 0) {
        setNfts([]);
        setIsLoading(false);
        return;
      }

      // 2. Query MintEvents to discover FanToken object IDs
      //    MintEvents contain token_id and creator, but not the object ID.
      //    Instead, we query all objects of the FanToken type.
      const fanTokenType = `${PACKAGE_ID}::${MODULE_NAME}::FanToken`;
      console.log("[useNFTs] Querying objects of type:", fanTokenType);

      let allObjects: any[] = [];
      let cursor: string | null | undefined = undefined;
      let hasMore = true;

      while (hasMore) {
        const page: any = await client.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::MintEvent`,
          },
          cursor: cursor || undefined,
          limit: 50,
          order: "ascending",
        });

        // From MintEvents we get token_id + creator but we need to find the actual object IDs
        // Let's use a different approach: query all objects of the FanToken type
        hasMore = false; // We'll use getOwnedObjects approach instead
      }

      // Better approach: Use queryTransactionBlocks to find created objects
      // Or use suix_queryEvents to get object IDs from the transaction effects
      // Simplest: query objects by type using Dynamic Field or event-based discovery

      // Use getObject on the collection's dynamic fields, or query events
      // The most reliable Sui approach: query all events, then getObject for each

      const eventsResult = await client.queryEvents({
        query: {
          MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::MintEvent`,
        },
        limit: 50,
        order: "ascending",
      });

      console.log("[useNFTs] Found", eventsResult.data.length, "MintEvents");

      // For each MintEvent, we need to find the corresponding FanToken object
      // We'll query transaction blocks for created objects
      const nftPromises = eventsResult.data.map(async (event) => {
        const eventData = event.parsedJson as any;
        const tokenId = Number(eventData.token_id);
        const creator = eventData.creator as string;
        const tokenUri = eventData.token_uri as string;

        try {
          // Get the transaction block that created this event to find the object ID
          const txBlock = await client.getTransactionBlock({
            digest: event.id.txDigest,
            options: { showObjectChanges: true },
          });

          // Find the created FanToken object
          const createdObject = txBlock.objectChanges?.find(
            (change) =>
              change.type === "created" &&
              (change as any).objectType?.includes("FanToken")
          );

          if (!createdObject || !("objectId" in createdObject)) {
            console.warn(`[useNFTs] Could not find FanToken object for token ${tokenId}`);
            return null;
          }

          const objectId = (createdObject as any).objectId;

          // Get the current state of the FanToken object
          const tokenObj = await client.getObject({
            id: objectId,
            options: { showContent: true },
          });

          if (!tokenObj.data?.content || tokenObj.data.content.dataType !== "moveObject") {
            console.warn(`[useNFTs] FanToken ${objectId} not found or not a Move object`);
            return null;
          }

          const fields = (tokenObj.data.content as any).fields;
          const totalFunded = BigInt(fields.total_funded || "0");
          const objTokenUri = fields.token_uri || tokenUri;

          // Fetch IPFS metadata
          let metadata: Record<string, any> = {};
          try {
            const res = await fetch(String(objTokenUri));
            if (res.ok) {
              metadata = await res.json();
            }
          } catch {
            console.warn(`[useNFTs] Failed to fetch metadata for token ${tokenId}`);
          }

          return {
            tokenId,
            objectId,
            metadata,
            owner: fields.creator || creator,
            totalDonations: totalFunded,
          } as NftData;
        } catch (err) {
          console.error(`[useNFTs] Error fetching NFT #${tokenId}:`, err);
          return null;
        }
      });

      const results = (await Promise.all(nftPromises)).filter(Boolean) as NftData[];
      console.log("[useNFTs] Loaded", results.length, "NFTs");
      setNfts(results);
    } catch (err) {
      console.error("[useNFTs] Failed to fetch NFTs:", err);
      setError(err instanceof Error ? err.message : "Failed to load NFTs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  return { nfts, totalSupply, isLoading, error, refetch: fetchNFTs };
}
