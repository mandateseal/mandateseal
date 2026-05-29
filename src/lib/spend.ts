import { prisma } from "./db";
import type { MandateSnapshot, PolicyDecision } from "./policy";
import type { ActionRequest } from "./schemas";

/** Return the start of the current UTC calendar day. */
export function startOfTodayUtc(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Pure-function daily-budget rule. Returns a BLOCKED decision if the proposed
 * action would push the agent's same-day APPROVED spend over `dailyBudgetUsd`.
 * Otherwise returns the original decision unchanged.
 *
 * Lives outside evaluatePolicy because budget enforcement requires a DB
 * aggregate (sum of today's APPROVED rows), which the synchronous engine
 * cannot do. Caller is responsible for fetching `todayApprovedUsd`.
 */
export function enforceDailyBudget(
  decision: PolicyDecision,
  action: Pick<ActionRequest, "costUsd">,
  snapshot: Pick<MandateSnapshot, "dailyBudgetUsd">,
  todayApprovedUsd: number,
): PolicyDecision {
  if (decision.decision !== "APPROVED") return decision;
  if (snapshot.dailyBudgetUsd <= 0) return decision;
  if (action.costUsd <= 0) return decision;
  const projected = todayApprovedUsd + action.costUsd;
  if (projected <= snapshot.dailyBudgetUsd) return decision;
  return {
    decision: "BLOCKED",
    reason:
      `Daily budget $${snapshot.dailyBudgetUsd.toFixed(2)} would be exceeded ` +
      `(spent today $${todayApprovedUsd.toFixed(2)} + this $${action.costUsd.toFixed(2)} = ` +
      `$${projected.toFixed(2)}).`,
    matchedRule: `dailySpendUsd > dailyBudgetUsd`,
    riskLevel: "MEDIUM",
  };
}

/**
 * Pure-function daily token-spend rule. Returns a BLOCKED decision if the
 * proposed transfer would push the agent's same-day APPROVED transferred
 * value over `dailyTokenSpendUsd`. Otherwise returns the decision unchanged.
 *
 * Mirrors enforceDailyBudget, but bounds onchain *value moved* (txValueUsd)
 * rather than API *cost* (costUsd) — the natural per-day ceiling for batch
 * payouts. Like the budget rule it needs a DB aggregate, so it lives here and
 * the caller fetches `todayTokenUsd`.
 */
export function enforceDailyTokenSpend(
  decision: PolicyDecision,
  action: Pick<ActionRequest, "txValueUsd">,
  snapshot: Pick<MandateSnapshot, "dailyTokenSpendUsd">,
  todayTokenUsd: number,
): PolicyDecision {
  if (decision.decision !== "APPROVED") return decision;
  if (snapshot.dailyTokenSpendUsd <= 0) return decision;
  const value = action.txValueUsd ?? 0;
  if (value <= 0) return decision;
  const projected = todayTokenUsd + value;
  if (projected <= snapshot.dailyTokenSpendUsd) return decision;
  return {
    decision: "BLOCKED",
    reason:
      `Daily token spend $${snapshot.dailyTokenSpendUsd.toFixed(2)} would be exceeded ` +
      `(sent today $${todayTokenUsd.toFixed(2)} + this $${value.toFixed(2)} = ` +
      `$${projected.toFixed(2)}).`,
    matchedRule: `dailyTokenValueUsd > dailyTokenSpendUsd`,
    riskLevel: "HIGH",
  };
}

/**
 * Sum of APPROVED receipt costs for one agent in a window. We only count
 * APPROVED rows because BLOCKED and NEEDS_APPROVAL actions never ran (no
 * money actually changed hands).
 */
export async function sumApprovedCost(args: {
  agentId: string;
  from: Date;
  to?: Date;
}): Promise<number> {
  const agg = await prisma.receipt.aggregate({
    where: {
      agentId: args.agentId,
      decision: "APPROVED",
      timestamp: { gte: args.from, ...(args.to ? { lt: args.to } : {}) },
    },
    _sum: { costUsd: true },
  });
  return agg._sum.costUsd ?? 0;
}

/**
 * Sum of APPROVED transferred value (txValueUsd) for one agent in a window.
 * Same APPROVED-only rationale as sumApprovedCost — only approved actions
 * actually moved funds onchain.
 */
export async function sumApprovedTxValue(args: {
  agentId: string;
  from: Date;
  to?: Date;
}): Promise<number> {
  const agg = await prisma.receipt.aggregate({
    where: {
      agentId: args.agentId,
      decision: "APPROVED",
      timestamp: { gte: args.from, ...(args.to ? { lt: args.to } : {}) },
    },
    _sum: { txValueUsd: true },
  });
  return agg._sum.txValueUsd ?? 0;
}

export interface AgentSpendRow {
  agentId: string;
  agentName: string;
  dailyBudgetUsd: number;
  todayUsd: number;
  weekUsd: number;
  monthUsd: number;
  totalUsd: number;
  todayPctOfBudget: number; // 0..∞
}

const DAY_MS = 86_400_000;

// NOTE: scales linearly with agent count (5 queries / agent). Fine for tens
// of agents; at 100+ rewrite with a single groupBy across the receipt table.
export async function listAgentSpend(): Promise<AgentSpendRow[]> {
  const now = new Date();
  const startToday = startOfTodayUtc(now);
  const startWeek = new Date(startToday.getTime() - 6 * DAY_MS);
  const startMonth = new Date(startToday.getTime() - 29 * DAY_MS);

  const agents = await prisma.agent.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return Promise.all(
    agents.map(async (a) => {
      const [mandate, todayUsd, weekUsd, monthUsd, totalAgg] = await Promise.all([
        prisma.mandate.findFirst({
          where: { agentId: a.id, enabled: true },
          orderBy: { createdAt: "desc" },
          select: { dailyBudgetUsd: true },
        }),
        sumApprovedCost({ agentId: a.id, from: startToday }),
        sumApprovedCost({ agentId: a.id, from: startWeek }),
        sumApprovedCost({ agentId: a.id, from: startMonth }),
        prisma.receipt.aggregate({
          where: { agentId: a.id, decision: "APPROVED" },
          _sum: { costUsd: true },
        }),
      ]);
      const budget = mandate?.dailyBudgetUsd ?? 0;
      const todayPctOfBudget = budget > 0 ? todayUsd / budget : 0;
      return {
        agentId: a.id,
        agentName: a.name,
        dailyBudgetUsd: budget,
        todayUsd,
        weekUsd,
        monthUsd,
        totalUsd: totalAgg._sum.costUsd ?? 0,
        todayPctOfBudget,
      };
    }),
  );
}
