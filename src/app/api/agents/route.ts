import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAgentSchema } from "@/lib/schemas";
import { generateApiKey, hashApiKey, randomId } from "@/lib/crypto";
import { publicAgent } from "@/lib/serialize";

export const runtime = "nodejs";

export async function GET() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ agents: agents.map(publicAgent) });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createAgentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const rawKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawKey);
  const id = randomId("agent");

  const agent = await prisma.agent.create({
    data: {
      id,
      name: parsed.data.name,
      role: parsed.data.role,
      apiKeyHash,
      status: "active",
    },
  });

  // raw apiKey is returned ONCE; never stored, never readable again.
  return NextResponse.json({ agent: publicAgent(agent), apiKey: rawKey }, { status: 201 });
}
