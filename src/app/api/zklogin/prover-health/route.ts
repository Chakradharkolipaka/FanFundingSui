import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ProbeResult = {
  url: string;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  error?: {
    message: string;
    code?: string;
    cause?: {
      message?: string;
      code?: string;
      errno?: number;
      syscall?: string;
      hostname?: string;
    };
  };
  sample?: string;
};

const DEFAULT_TIMEOUT_MS = 6000;

async function probe(url: string): Promise<ProbeResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    // We send an intentionally-invalid body. We only care that we can reach the host
    // and get *any* HTTP response (4xx is fine).
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");
    return {
      url,
      ok: true,
      status: res.status,
      latencyMs: Date.now() - started,
      sample: text.slice(0, 200),
    };
  } catch (e: any) {
    const cause = e?.cause;
    return {
      url,
      ok: false,
      latencyMs: Date.now() - started,
      error: {
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
    };
  } finally {
    clearTimeout(timer);
  }
}

// Candidate prover endpoints for testnet/dev experimentation.
// These endpoints have historically changed; this route exists to discover which
// ones are reachable from your current environment (local dev, Vercel, etc.).
const CANDIDATE_PROVER_URLS = [
  // Common examples / historical patterns:
  "https://prover.testnet.sui.io/v1",
  "https://prover.testnet.sui.io",

  // Some hosted services use sui-<network>.mystenlabs.com (may be blocked by DNS in some environments):
  "https://sui-testnet.mystenlabs.com/prover/v1",
  "https://sui-testnet.mystenlabs.com/zklogin/v1",

  // Some deployments may use a dedicated subdomain:
  "https://zklogin-prover.testnet.sui.io/v1",
  "https://zklogin.testnet.sui.io/v1",
];

export async function GET() {
  const results = await Promise.all(CANDIDATE_PROVER_URLS.map((u) => probe(u)));

  // Best candidate: any reachable endpoint with an HTTP response.
  const reachable = results.filter((r) => r.ok);
  const best = reachable.sort((a, b) => (a.latencyMs ?? 0) - (b.latencyMs ?? 0))[0];

  return NextResponse.json({
    env: {
      configuredProverUrl: process.env.ZKLOGIN_PROVER_URL ?? null,
      note: "This endpoint probes candidate zkLogin prover URLs from the current runtime.",
    },
    best: best ?? null,
    results,
  });
}
