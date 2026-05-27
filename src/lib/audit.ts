import { prisma } from "./db";

export interface AuditStats {
  total: number;
  totalCostUsd: number;
  byDecision: Array<{ decision: string; count: number; costUsd: number }>;
  topTools: Array<{ tool: string; count: number }>;
  topActions: Array<{ actionType: string; count: number }>;
  topMatchedRules: Array<{ rule: string; count: number }>;
  perAgent: Array<{
    agentId: string;
    total: number;
    approved: number;
    blocked: number;
    needsApproval: number;
    totalCostUsd: number;
  }>;
  perMandate: Array<{ mandateId: string; count: number; costUsd: number }>;
}

export async function computeAuditStats(range?: { from?: Date; to?: Date }): Promise<AuditStats> {
  const where: Record<string, unknown> = {};
  if (range?.from || range?.to) {
    where.timestamp = {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lte: range.to } : {}),
    };
  }

  const [byDecision, byTool, byAction, byRule, byAgent, byMandate, totals] = await Promise.all([
    prisma.receipt.groupBy({
      by: ["decision"],
      where,
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    prisma.receipt.groupBy({
      by: ["tool"],
      where,
      _count: { _all: true },
      orderBy: { _count: { tool: "desc" } },
      take: 10,
    }),
    prisma.receipt.groupBy({
      by: ["actionType"],
      where,
      _count: { _all: true },
      orderBy: { _count: { actionType: "desc" } },
      take: 10,
    }),
    prisma.receipt.groupBy({
      by: ["matchedRule"],
      where,
      _count: { _all: true },
      orderBy: { _count: { matchedRule: "desc" } },
      take: 10,
    }),
    prisma.receipt.groupBy({
      by: ["agentId", "decision"],
      where,
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
    prisma.receipt.groupBy({
      by: ["mandateId"],
      where,
      _count: { _all: true },
      _sum: { costUsd: true },
      orderBy: { _count: { mandateId: "desc" } },
      take: 10,
    }),
    prisma.receipt.aggregate({
      where,
      _count: { _all: true },
      _sum: { costUsd: true },
    }),
  ]);

  const perAgent: Record<
    string,
    { agentId: string; total: number; approved: number; blocked: number; needsApproval: number; totalCostUsd: number }
  > = {};
  for (const row of byAgent) {
    const a = (perAgent[row.agentId] ??= {
      agentId: row.agentId,
      total: 0,
      approved: 0,
      blocked: 0,
      needsApproval: 0,
      totalCostUsd: 0,
    });
    a.total += row._count._all;
    a.totalCostUsd += row._sum.costUsd ?? 0;
    if (row.decision === "APPROVED") a.approved = row._count._all;
    if (row.decision === "BLOCKED") a.blocked = row._count._all;
    if (row.decision === "NEEDS_APPROVAL") a.needsApproval = row._count._all;
  }

  return {
    total: totals._count._all,
    totalCostUsd: totals._sum.costUsd ?? 0,
    byDecision: byDecision.map((r) => ({
      decision: r.decision,
      count: r._count._all,
      costUsd: r._sum.costUsd ?? 0,
    })),
    topTools: byTool.map((r) => ({ tool: r.tool, count: r._count._all })),
    topActions: byAction.map((r) => ({ actionType: r.actionType, count: r._count._all })),
    topMatchedRules: byRule.map((r) => ({ rule: r.matchedRule, count: r._count._all })),
    perAgent: Object.values(perAgent).sort((a, b) => b.total - a.total),
    perMandate: byMandate.map((r) => ({
      mandateId: r.mandateId,
      count: r._count._all,
      costUsd: r._sum.costUsd ?? 0,
    })),
  };
}
