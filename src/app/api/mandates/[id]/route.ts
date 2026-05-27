import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { updateMandateSchema } from "@/lib/schemas";
import { publicMandate } from "@/lib/serialize";
import { serializeListsForDb } from "@/lib/mandate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const m = await prisma.mandate.findUnique({ where: { id: params.id } });
  if (!m) return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
  return NextResponse.json({ mandate: publicMandate(m) });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateMandateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const existing = await prisma.mandate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Mandate not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.dailyBudgetUsd !== undefined) data.dailyBudgetUsd = parsed.data.dailyBudgetUsd;
  if (parsed.data.maxCostPerActionUsd !== undefined) data.maxCostPerActionUsd = parsed.data.maxCostPerActionUsd;
  if (parsed.data.approvalThresholdUsd !== undefined) data.approvalThresholdUsd = parsed.data.approvalThresholdUsd;
  Object.assign(data, serializeListsForDb(parsed.data));
  // v0.2 — wallet mandate scalar fields. Treat `undefined` as "don't touch"
  // and `null`/empty-string on the wallet fields as "clear it".
  if (parsed.data.agentWallet !== undefined) data.agentWallet = parsed.data.agentWallet || null;
  if (parsed.data.ownerWallet !== undefined) data.ownerWallet = parsed.data.ownerWallet || null;
  if (parsed.data.maxTxValueUsd !== undefined) data.maxTxValueUsd = parsed.data.maxTxValueUsd;
  if (parsed.data.dailyTokenSpendUsd !== undefined) data.dailyTokenSpendUsd = parsed.data.dailyTokenSpendUsd;
  if (parsed.data.requireApprovalForSwaps !== undefined) data.requireApprovalForSwaps = parsed.data.requireApprovalForSwaps;
  if (parsed.data.requireApprovalForTransfers !== undefined) data.requireApprovalForTransfers = parsed.data.requireApprovalForTransfers;

  const m = await prisma.mandate.update({ where: { id: params.id }, data });
  return NextResponse.json({ mandate: publicMandate(m) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const existing = await prisma.mandate.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Mandate not found" }, { status: 404 });
  await prisma.mandate.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
