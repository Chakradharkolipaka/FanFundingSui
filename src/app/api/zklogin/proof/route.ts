import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

export const runtime = "nodejs";

// Default hosted prover (Mysten-maintained) for dev/test usage.
// If this endpoint changes, override it via `ZKLOGIN_PROVER_URL` in `.env.local`.
const DEFAULT_ZKLOGIN_PROVER_URL_TESTNET = "https://prover.testnet.sui.io/v1";

type Body = {
  jwt: string;
  ephemeralPublicKey: string;
  randomness: string;
  maxEpoch: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const { jwt, ephemeralPublicKey, randomness, maxEpoch } = body;

    if (!jwt || !ephemeralPublicKey || !randomness || !maxEpoch) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const proverUrl = process.env.ZKLOGIN_PROVER_URL || DEFAULT_ZKLOGIN_PROVER_URL_TESTNET;

    const decoded: any = decodeJwt(jwt);
    const jwtExp = typeof decoded?.exp === "number" ? decoded.exp : undefined;

    // Mysten prover expects JWT + eph pk + maxEpoch + randomness.
    // We don’t send any server secrets.
    let proverRes: Response;
    try {
      proverRes = await fetch(proverUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jwt,
          extendedEphemeralPublicKey: ephemeralPublicKey,
          maxEpoch,
          jwtRandomness: randomness,
        }),
      });
    } catch (e: any) {
      // Common: DNS failures (ENOTFOUND), blocked domains, corporate proxies, etc.
      const cause = e?.cause;
      return NextResponse.json(
        {
          error: "Failed to reach zkLogin prover endpoint",
          proverUrl,
          details: {
            message: e?.message ?? String(e),
            code: e?.code,
            cause: cause
              ? {
                  message: cause?.message,
                  code: cause?.code,
                  errno: cause?.errno,
                  syscall: cause?.syscall,
                  hostname: cause?.hostname,
                }
              : undefined,
          },
        },
        { status: 502 }
      );
    }

    if (!proverRes.ok) {
      const text = await proverRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Prover error: ${proverRes.status} ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const payload = await proverRes.json();

    // Common response fields are zkProof + addressSeed (names can vary by prover).
    const zkProof = payload.zkProof ?? payload.proof ?? payload;
    const addressSeed = payload.addressSeed ?? payload.address_seed;

    if (!zkProof || addressSeed === undefined) {
      return NextResponse.json(
        { error: "Prover response missing zkProof/addressSeed", proverResponse: payload },
        { status: 502 }
      );
    }

    return NextResponse.json({
      zkProof,
      addressSeed,
      jwtExp,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
