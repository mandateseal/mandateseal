import { NextResponse } from "next/server";
import { listAgentSpend } from "@/lib/spend";

export const runtime = "nodejs";

// GET /api/audit/spend
// Per-agent spend across today / week / month / total, plus % of daily budget.
export async function GET() {
  const rows = await listAgentSpend();
  return NextResponse.json({ agents: rows });
}
