import { NextResponse } from "next/server";
import { auditAnchorChain } from "@/lib/anchor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/anchor/audit
// Re-walk the entire chain: every batch's root must recompute from leaves,
// every prevRoot must equal the previous batch's root.
export async function GET() {
  const result = await auditAnchorChain();
  return NextResponse.json(result);
}
