import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateReputation } from "@/lib/reputation";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/agents/:id/reputation
// Public — anyone can pull an agent's reputation snapshot without auth.
// Score is computed from the receipt table on every call so it always
// reflects the current state. Cheap aggregation (groupBy + min/max), no
// caching layer yet.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const lim = checkRateLimit(`rep:ip:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!lim.allowed) {
    const r = rateLimitResponse(lim);
    return NextResponse.json(r.body, r.init);
  }

  const agent = await prisma.agent.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, role: true, status: true, createdAt: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const [byDecision, anchoredCount, span] = await Promise.all([
    prisma.receipt.groupBy({
      by: ["decision"],
      where: { agentId: params.id },
      _count: { _all: true },
    }),
    prisma.receipt.count({
      where: { agentId: params.id, anchorBatchId: { not: null } },
    }),
    prisma.receipt.aggregate({
      where: { agentId: params.id },
      _min: { timestamp: true },
      _max: { timestamp: true },
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of byDecision) counts[r.decision] = r._count._all;

  const total = span._count._all;
  const reputation = calculateReputation({
    total,
    approved: counts.APPROVED ?? 0,
    blocked: counts.BLOCKED ?? 0,
    needsApproval: counts.NEEDS_APPROVAL ?? 0,
    anchored: anchoredCount,
    firstSeenAt: span._min.timestamp,
    lastSeenAt: span._max.timestamp,
  });

  return NextResponse.json({
    agent: {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      registeredAt: agent.createdAt.toISOString(),
    },
    reputation,
    counts: {
      total,
      approved: counts.APPROVED ?? 0,
      blocked: counts.BLOCKED ?? 0,
      needsApproval: counts.NEEDS_APPROVAL ?? 0,
      anchored: anchoredCount,
    },
  });
}
