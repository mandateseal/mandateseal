import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicAgent } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const agent = await prisma.agent.findUnique({ where: { id: params.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  return NextResponse.json({ agent: publicAgent(agent) });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const agent = await prisma.agent.findUnique({ where: { id: params.id } });
  if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  // Cascades to mandates and receipts via Prisma schema onDelete.
  await prisma.agent.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
