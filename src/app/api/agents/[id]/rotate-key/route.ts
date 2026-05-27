import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateApiKey, hashApiKey } from "@/lib/crypto";
import { publicAgent } from "@/lib/serialize";

export const runtime = "nodejs";

// POST /api/agents/:id/rotate-key
// Issues a fresh API key for the agent and invalidates the previous one.
// Raw key is returned ONCE and never stored.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const existing = await prisma.agent.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  const rawKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawKey);
  const agent = await prisma.agent.update({
    where: { id: params.id },
    data: { apiKeyHash },
  });

  return NextResponse.json({ agent: publicAgent(agent), apiKey: rawKey });
}
