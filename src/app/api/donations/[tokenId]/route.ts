import { NextResponse } from "next/server";

const SUI_NODE_URL =
  process.env.NEXT_PUBLIC_SUI_NODE_URL || "https://fullnode.testnet.sui.io:443";
const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || "";

export const dynamic = "force-dynamic";

/**
 * GET /api/donations/[tokenId]
 * Fetches donation events for a specific NFT from the Sui module events.
 *
 * On Sui, we query DonationEvents emitted by the contract using queryEvents.
 */
export async function GET(
  request: Request,
  { params }: { params: { tokenId: string } }
) {
  try {
    const tokenId = parseInt(params.tokenId);
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    if (!PACKAGE_ID) {
      return NextResponse.json({ error: "Package ID not configured" }, { status: 500 });
    }

    // Query DonationEvents from the Sui RPC
    const eventType = `${PACKAGE_ID}::nft_donation::DonationEvent`;

    const rpcPayload = {
      jsonrpc: "2.0",
      id: 1,
      method: "suix_queryEvents",
      params: [
        { MoveEventType: eventType },
        null, // cursor
        50,   // limit
        false, // descending
      ],
    };

    const eventsRes = await fetch(SUI_NODE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcPayload),
    });

    if (!eventsRes.ok) {
      const txt = await eventsRes.text();
      console.error("Failed to fetch events:", eventsRes.status, txt);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 502 });
    }

    const rpcResult = await eventsRes.json();

    if (rpcResult.error) {
      console.error("RPC error:", rpcResult.error);
      return NextResponse.json({ error: rpcResult.error.message }, { status: 502 });
    }

    const events = rpcResult.result?.data || [];

    // Filter events for the requested tokenId
    const donations: Array<{
      donor: string;
      amount: string;
      creator: string;
      txDigest: string;
    }> = [];

    for (const event of events) {
      const data = event.parsedJson;
      if (data && parseInt(data.token_id) === tokenId) {
        donations.push({
          donor: data.donor,
          amount: data.amount,
          creator: data.creator,
          txDigest: event.id?.txDigest || "",
        });
      }
    }

    return NextResponse.json(donations);
  } catch (error) {
    console.error("Error fetching donations:", error);
    return NextResponse.json(
      { error: "Failed to fetch donations" },
      { status: 500 }
    );
  }
}
