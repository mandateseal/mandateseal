import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createMandateSchema } from "@/lib/schemas";
import { randomId } from "@/lib/crypto";
import { publicMandate } from "@/lib/serialize";
import { serializeListsForDb } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const mandates = await prisma.mandate.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ mandates: mandates.map(publicMandate) });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createMandateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const agent = await prisma.agent.findUnique({ where: { id: parsed.data.agentId } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const m = await prisma.mandate.create({
    data: {
      id: randomId("mandate"),
      agentId: parsed.data.agentId,
      name: parsed.data.name,
      enabled: parsed.data.enabled ?? true,
      dailyBudgetUsd: parsed.data.dailyBudgetUsd,
      maxCostPerActionUsd: parsed.data.maxCostPerActionUsd,
      approvalThresholdUsd: parsed.data.approvalThresholdUsd,
      ...serializeListsForDb(parsed.data),
      // v0.2 — wallet mandate scalar fields. Zod defaults handle the
      // numeric/boolean cases; nullable wallet fields stay null when absent.
      agentWallet: parsed.data.agentWallet ?? null,
      ownerWallet: parsed.data.ownerWallet ?? null,
      maxTxValueUsd: parsed.data.maxTxValueUsd,
      dailyTokenSpendUsd: parsed.data.dailyTokenSpendUsd,
      requireApprovalForSwaps: parsed.data.requireApprovalForSwaps,
      requireApprovalForTransfers: parsed.data.requireApprovalForTransfers,
    },
  });

  return NextResponse.json({ mandate: publicMandate(m) }, { status: 201 });
}
