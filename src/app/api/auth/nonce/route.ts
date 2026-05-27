import { NextResponse } from "next/server";
import { generateNonce, NONCE_COOKIE } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/nonce
// Issues a short-lived nonce the client embeds in its SIWE message.
// Nonce is stored in an httpOnly cookie so the server can verify replay-protection
// without keeping server-side state.
export async function GET() {
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
