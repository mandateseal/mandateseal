import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { actionRequestSchema } from "@/lib/schemas";
import { evaluateAndSeal } from "@/lib/receipt";
import { publicReceipt } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 500);
  const receipts = await prisma.receipt.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { timestamp: "desc" },
    take: limit,
  });
  return NextResponse.json({ receipts: receipts.map(publicReceipt) });
}

// Manual receipt generation (e.g. from the dashboard simulator). Uses agentId
// from body, no bearer required. /api/check is the auth-protected path.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const receipt = await evaluateAndSeal(parsed.data);
    return NextResponse.json({ receipt }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
