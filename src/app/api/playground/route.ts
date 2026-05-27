import { NextResponse } from "next/server";
import { runScript } from "@/lib/playground";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/playground
// Returns 8 scripted, sealed-but-not-persisted receipts so the /playground
// page can replay them with a typing-style reveal. No DB writes, no rate
// load on /api/check, no demo-key burning.
export async function GET(req: Request) {
  const lim = checkRateLimit(`playground:ip:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
  if (!lim.allowed) {
    const r = rateLimitResponse(lim);
    return NextResponse.json(r.body, r.init);
  }
  const steps = runScript();
  return NextResponse.json({ steps });
}
