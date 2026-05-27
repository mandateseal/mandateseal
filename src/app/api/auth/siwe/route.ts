import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import {
  isAdminAddress,
  isAuthEnabled,
  issueSessionToken,
  NONCE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/auth/siwe
// Body: { message: string (raw SIWE), signature: string }
// Verifies the signature, checks the nonce against the cookie issued by
// /api/auth/nonce, and — if the recovered address is in the admin allowlist —
// issues a session cookie.
export async function POST(req: Request) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ ok: true, mode: "open" });
  }

  let body: { message?: string; signature?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.message || !body.signature) {
    return NextResponse.json({ error: "message and signature required" }, { status: 400 });
  }

  const expectedNonce = req.headers.get("cookie")?.match(
    new RegExp(`${NONCE_COOKIE}=([^;]+)`),
  )?.[1];
  if (!expectedNonce) {
    return NextResponse.json({ error: "Missing nonce — refresh and retry" }, { status: 400 });
  }

  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(body.message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Malformed SIWE message";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  let verified;
  try {
    verified = await siwe.verify({ signature: body.signature, nonce: expectedNonce });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
  if (!verified.success) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const address = verified.data.address;
  if (!isAdminAddress(address)) {
    return NextResponse.json({ error: "Wallet not authorized" }, { status: 403 });
  }

  const token = await issueSessionToken();
  const res = NextResponse.json({ ok: true, address });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
  res.cookies.delete(NONCE_COOKIE);
  return res;
}
