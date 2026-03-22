import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { getZkLoginProverProvider } from "@/lib/zklogin/providers";
import { createDockerProverProvider } from "@/lib/zklogin/providers/dockerProver";

export const runtime = "nodejs";

// Default hosted prover (Mysten-maintained) for dev/test usage.
// If this endpoint changes, override it via `ZKLOGIN_PROVER_URL` in `.env.local`.
const DEFAULT_ZKLOGIN_PROVER_URL_TESTNET = "https://prover.testnet.sui.io/v1";

type Body = {
  jwt: string;
  ephemeralPublicKey: string;
  /** Optional: Sui-format base64 (flag + pk) for Enoki HTTP API */
  ephemeralPublicKeySuiB64?: string;
  randomness: string;
  maxEpoch: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
  const { jwt, ephemeralPublicKey, ephemeralPublicKeySuiB64, randomness, maxEpoch } = body;

    if (!jwt || !ephemeralPublicKey || !randomness || !maxEpoch) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const decoded: any = decodeJwt(jwt);
    const jwtExp = typeof decoded?.exp === "number" ? decoded.exp : undefined;

  const provider = getZkLoginProverProvider(process.env);

    // Back-compat:
    // - If user didn't configure ZKLOGIN_PROVER_URL, keep the historical default.
    // - This default only applies to the docker-like provider.
    if (provider.name === "docker" && !process.env.ZKLOGIN_PROVER_URL) {
      process.env.ZKLOGIN_PROVER_URL = DEFAULT_ZKLOGIN_PROVER_URL_TESTNET;
    }

    try {
      const { zkProof, addressSeed } = await provider.prove({
        jwt,
        ephemeralPublicKey,
        ephemeralPublicKeySuiB64,
        randomness,
        maxEpoch,
      });

      return NextResponse.json({
        provider: provider.name,
        zkProof,
        addressSeed,
        jwtExp,
      });
    } catch (e: any) {
      // Enoki is rate-limited; fall back to the hosted/default prover when it returns 429/rate_limit.
      const msg = e?.message ? String(e.message) : "";
      const shouldFallback =
        provider.name === "enoki" &&
        (msg.includes("429") || msg.toLowerCase().includes("rate_limit"));

      if (shouldFallback) {
        const dockerProverUrl = process.env.ZKLOGIN_PROVER_URL || DEFAULT_ZKLOGIN_PROVER_URL_TESTNET;
        const fallbackProvider = createDockerProverProvider({ proverUrl: dockerProverUrl });
        try {
          const { zkProof, addressSeed } = await fallbackProvider.prove({
            jwt,
            ephemeralPublicKey,
            randomness,
            maxEpoch,
          });

          return NextResponse.json({
            provider: fallbackProvider.name,
            zkProof,
            addressSeed,
            jwtExp,
            fallbackReason: msg.slice(0, 200),
          });
        } catch (fallbackErr: any) {
          return NextResponse.json(
            {
              error: fallbackErr?.message ?? "Prover failed (fallback)",
              provider: fallbackProvider.name,
              fallbackReason: msg.slice(0, 200),
            },
            { status: 502 }
          );
        }
      }

      // Keep previous behavior of returning a 502 for prover upstream issues.
      return NextResponse.json(
        {
          error: e?.message ?? "Prover failed",
          provider: provider.name,
        },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
