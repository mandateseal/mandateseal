import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createAgentSchema } from "@/lib/schemas";
import { generateApiKey, hashApiKey, randomId } from "@/lib/crypto";
import { publicAgent, publicMandate } from "@/lib/serialize";
import { DEFAULT_MANDATE } from "@/lib/constants";

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

  // Create agent + seed a sensible default mandate so the new agent is
  // immediately usable. Without this the dashboard would have empty allow/block
  // lists and only cost rules would apply.
  const slug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const [agent, mandate] = await prisma.$transaction([
    prisma.agent.create({
      data: {
        id,
        name: parsed.data.name,
        role: parsed.data.role,
        apiKeyHash,
        status: "active",
      },
    }),
    prisma.mandate.create({
      data: {
        id: randomId("mandate"),
        agentId: id,
        name: `${slug || "agent"}-mandate-v1`,
        enabled: true,
        dailyBudgetUsd: DEFAULT_MANDATE.dailyBudgetUsd,
        maxCostPerActionUsd: DEFAULT_MANDATE.maxCostPerActionUsd,
        approvalThresholdUsd: DEFAULT_MANDATE.approvalThresholdUsd,
        allowedTools: JSON.stringify(DEFAULT_MANDATE.allowedTools),
        blockedTools: JSON.stringify(DEFAULT_MANDATE.blockedTools),
        blockedActions: JSON.stringify(DEFAULT_MANDATE.blockedActions),
        approvalRequiredActions: JSON.stringify(DEFAULT_MANDATE.approvalRequiredActions),
        allowedDomains: JSON.stringify(DEFAULT_MANDATE.allowedDomains),
        blockedDomains: JSON.stringify(DEFAULT_MANDATE.blockedDomains),
      },
    }),
  ]);

  // raw apiKey is returned ONCE; never stored, never readable again.
  return NextResponse.json(
    {
      agent: publicAgent(agent),
      mandate: publicMandate(mandate),
      apiKey: rawKey,
    },
    { status: 201 },
  );
}
