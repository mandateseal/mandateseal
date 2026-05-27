import { NextResponse } from "next/server";
import { computeAuditStats } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const range: { from?: Date; to?: Date } = {};
  if (fromStr) range.from = new Date(fromStr);
  if (toStr) range.to = new Date(toStr);
  const stats = await computeAuditStats(range);
  return NextResponse.json(stats);
}
