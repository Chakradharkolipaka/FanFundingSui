import { NextResponse } from "next/server";
import { decodeJwt } from "jose";

export const runtime = "nodejs";

type Body = {
  jwt: string;
};

function pickStringOrArray(v: unknown): string[] | string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  return null;
}

/**
 * Debug endpoint: returns non-sensitive JWT metadata so we can verify `aud` / `azp` / `nonce`
 * when Enoki returns `invalid_client_id`.
 *
 * Do not log or persist the JWT. This endpoint only decodes the payload (no verification).
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body?.jwt) {
      return NextResponse.json({ error: "Missing jwt" }, { status: 400 });
    }

    const decoded: any = decodeJwt(body.jwt);

    // Common Google ID token fields:
    const meta = {
      iss: typeof decoded?.iss === "string" ? decoded.iss : null,
      aud: pickStringOrArray(decoded?.aud),
      azp: typeof decoded?.azp === "string" ? decoded.azp : null,
      nonce: typeof decoded?.nonce === "string" ? decoded.nonce : null,
      sub: typeof decoded?.sub === "string" ? decoded.sub : null,
      email: typeof decoded?.email === "string" ? decoded.email : null,
      exp: typeof decoded?.exp === "number" ? decoded.exp : null,
      iat: typeof decoded?.iat === "number" ? decoded.iat : null,
    };

    return NextResponse.json({ meta });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
