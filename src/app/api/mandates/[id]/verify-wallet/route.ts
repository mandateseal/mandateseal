import { NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { prisma } from "@/lib/db";
import { NONCE_COOKIE } from "@/lib/admin-auth";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/mandates/:id/verify-wallet  — v0.8.5 (fee-gate prerequisite)
// Body: { message: string (raw SIWE), signature: string }
//
// Proves control of the mandate's `ownerWallet` via SIWE (GET /api/auth/nonce
// first for the replay nonce). On success sets `ownerWalletVerified = true`, so
// the fee-gate trusts this owner for on-chain entitlement lookups.
//
// Public by design — the SIWE signature IS the auth (you can only verify a wallet
// you control, and only flip the flag for the address already on the mandate; you
// can't change ownerWallet here). See ALWAYS_PUBLIC_API_PATHS in middleware.ts.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const lim = checkRateLimit(`verify-wallet:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
  if (!lim.allowed) {
    const r = rateLimitResponse(lim);
    return NextResponse.json(r.body, r.init);
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
    return NextResponse.json({ error: "Missing nonce — GET /api/auth/nonce first" }, { status: 400 });
  }

  const mandate = await prisma.mandate.findUnique({
    where: { id: params.id },
    select: { id: true, ownerWallet: true, ownerWalletVerified: true },
  });
  if (!mandate) return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
  if (!mandate.ownerWallet) {
    return NextResponse.json({ error: "Mandate has no ownerWallet to verify" }, { status: 400 });
  }

  let siwe: SiweMessage;
  try {
    siwe = new SiweMessage(body.message);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Malformed SIWE message" },
      { status: 400 },
    );
  }

  let verified;
  try {
    verified = await siwe.verify({ signature: body.signature, nonce: expectedNonce });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signature verification failed" },
      { status: 401 },
    );
  }
  if (!verified.success) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  if (verified.data.address.toLowerCase() !== mandate.ownerWallet.toLowerCase()) {
    return NextResponse.json(
      { error: "Signed address does not match the mandate's ownerWallet" },
      { status: 403 },
    );
  }

  await prisma.mandate.update({
    where: { id: mandate.id },
    data: { ownerWalletVerified: true },
  });

  const res = NextResponse.json({
    ok: true,
    mandateId: mandate.id,
    ownerWallet: mandate.ownerWallet,
    ownerWalletVerified: true,
  });
  res.cookies.delete(NONCE_COOKIE);
  return res;
}
