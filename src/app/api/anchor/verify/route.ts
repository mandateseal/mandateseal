import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAnchorProof } from "@/lib/anchor";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  receiptHash: z.string().regex(/^[0-9a-f]{64}$/, "expected 64-char hex"),
  proof: z.array(z.string().regex(/^[0-9a-f]{64}$/)),
  root: z.string().regex(/^[0-9a-f]{64}$/),
});

// POST /api/anchor/verify
// Standalone proof verification — no DB lookup. Caller supplies the leaf,
// the sibling-path proof, and the claimed merkle root.
export async function POST(req: Request) {
  const lim = checkRateLimit(`anchor-verify:ip:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!lim.allowed) {
    const r = rateLimitResponse(lim);
    return NextResponse.json(r.body, r.init);
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }
  const valid = verifyAnchorProof(parsed.data);
  return NextResponse.json({ valid });
}
