import { NextResponse } from "next/server";
import { generateNonce, NONCE_COOKIE } from "@/lib/admin-auth";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/nonce
// Issues a short-lived nonce the client embeds in its SIWE message.
// Nonce is stored in an httpOnly cookie so the server can verify replay-protection
// without keeping server-side state.
export async function GET(req: Request) {
  const lim = checkRateLimit(`auth:nonce:${clientIp(req)}`, { limit: 20, windowMs: 60_000 });
  if (!lim.allowed) {
    const r = rateLimitResponse(lim);
    return NextResponse.json(r.body, r.init);
  }
  const nonce = generateNonce();
  const res = NextResponse.json({ nonce });
  res.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10, // 10 minutes
  });
  return res;
}
