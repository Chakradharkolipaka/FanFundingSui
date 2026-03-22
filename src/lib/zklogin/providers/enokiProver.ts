import type { ProverInput, ProverOutput, ZkLoginProverProvider } from "./types";

type SuiNetwork = "testnet" | "devnet" | "mainnet";

function normalizeSuiNetwork(raw: string | undefined): SuiNetwork {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "mainnet") return "mainnet";
  if (v === "devnet") return "devnet";
  // default
  return "testnet";
}

/**
 * Enoki-based prover provider.
 *
 * NOTE: Enoki endpoints/payloads may vary. We keep all Enoki-specific logic
 * isolated to this file so swapping the exact endpoint is a one-file change.
 */
export function createEnokiProverProvider(opts: {
  apiBaseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}): ZkLoginProverProvider {
  const base = opts.apiBaseUrl.replace(/\/+$/, "");
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const network = normalizeSuiNetwork(process.env.SUI_NETWORK);

  return {
    name: "enoki",
    async prove(input: ProverInput): Promise<ProverOutput> {
      if (!opts.apiKey) throw new Error("ENOKI_API_KEY is not configured");
      if (!base) throw new Error("ENOKI_API_BASE_URL is not configured");

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);

      try {
        // Official Enoki HTTP API (v1):
        // - Base URL (versioned): https://api.enoki.mystenlabs.com/v1
        // - Create ZK proof: POST /zklogin/zkp
        //   Auth: Authorization: Bearer <API_KEY>
        //   Header: zklogin-jwt: <JWT>
        //   Body: { network?, ephemeralPublicKey, maxEpoch, randomness }
        const res = await fetch(`${base}/zklogin/zkp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${opts.apiKey}`,
            "zklogin-jwt": input.jwt,
          },
          signal: ac.signal,
          body: JSON.stringify({
            network,
            // Enoki expects base64 of PublicKey.toSuiBytes(); fall back to extended if not provided.
            ephemeralPublicKey: input.ephemeralPublicKeySuiB64 ?? input.ephemeralPublicKey,
            randomness: input.randomness,
            maxEpoch: input.maxEpoch,
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Enoki prove failed (${res.status}): ${text.slice(0, 200)}`);
        }

        const payload = await res.json().catch(() => ({}));

        // Enoki wraps responses in { data: { ... } }
        const data = payload?.data ?? payload;

        // Enoki response uses proof fields directly, not nested under zkProof.
        // We convert it to the same shape the rest of this app expects.
        const addressSeed = data?.addressSeed;
        const zkProof = {
          proofPoints: data?.proofPoints,
          issBase64Details: data?.issBase64Details,
          headerBase64: data?.headerBase64,
        };

        if (!addressSeed || zkProof.proofPoints == null || zkProof.issBase64Details == null || zkProof.headerBase64 == null) {
          throw new Error("Enoki response missing proof fields/addressSeed");
        }

        return {
          zkProof,
          addressSeed: String(addressSeed),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
