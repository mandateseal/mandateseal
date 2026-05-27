import { NextResponse } from "next/server";
import { getPublicKeyPem } from "@/lib/crypto";

export const runtime = "nodejs";

// GET /api/key.pub
// Returns the Ed25519 public key in PEM, served as text/plain so it can be
// piped directly into any verifier: `curl localhost:3000/api/key.pub > pub.pem`
export async function GET() {
  const pem = getPublicKeyPem();
  return new NextResponse(pem, {
    status: 200,
    headers: {
      "content-type": "application/x-pem-file; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
