import { prisma } from "./db";
import { startOfTodayUtc } from "./spend";
import type { PolicyDecision } from "./policy";

// v0.8.4 — fee-gate (token utility). Prepaid-credits model: an owner deposits
// the MandateSeal token to the FeeVault contract, which grants off-chain credits
// (set by the deposit indexer). Each agent gets a free daily check quota; beyond
// it, a paid action consumes one credit. Out of credits → BLOCKED until topped up.
//
// Shipped DARK: when FEE_GATE_ENABLED is false the gate is never invoked, so live
// behavior is unchanged. It flips on at the token launch (W10).

/** Master switch. Off by default — the gate is a no-op until the launch flip. */
export const FEE_GATE_ENABLED = process.env.FEE_GATE_ENABLED === "true";

/** Free APPROVED checks per agent per UTC day before prepaid credits are required. */
export const FREE_DAILY_CHECKS = Number(process.env.FEE_GATE_FREE_DAILY_CHECKS ?? 100);

/**
 * Pure-function fee-gate. Mirrors enforceDailyBudget: blocks an APPROVED action
 * only when the agent is past its free daily quota AND has no prepaid credits.
 * Within the free quota, or with credits remaining, the decision is unchanged.
 * Side-effect-free (metering happens in the caller) so it is trivially testable.
 */
export function enforceFeeGate(
  decision: PolicyDecision,
  args: { overFreeQuota: boolean; creditsRemaining: number },
): PolicyDecision {
  if (decision.decision !== "APPROVED") return decision;
  if (!args.overFreeQuota) return decision; // still inside the free tier
  if (args.creditsRemaining > 0) return decision; // past the quota, but funded
  return {
    decision: "BLOCKED",
    reason:
      "Free daily quota used and no prepaid credits. " +
      "Deposit the MandateSeal token to FeeVault to continue paid actions.",
    matchedRule: "feeGate.insufficientCredits",
    riskLevel: "LOW",
  };
}

/** Count of today's APPROVED checks for an agent — the free-quota counter. */
export async function countApprovedChecksToday(agentId: string): Promise<number> {
  return prisma.receipt.count({
    where: { agentId, decision: "APPROVED", timestamp: { gte: startOfTodayUtc() } },
  });
}

/** Remaining prepaid credits for an owner wallet (granted − consumed, floored at 0). */
export async function creditsRemaining(ownerWallet: string): Promise<number> {
  const e = await prisma.entitlement.findUnique({
    where: { ownerWallet: ownerWallet.toLowerCase() },
  });
  if (!e) return 0;
  return Math.max(0, e.granted - e.consumed);
}

/** Meter usage against an owner wallet after an APPROVED paid action. */
export async function meterUsage(ownerWallet: string, units = 1): Promise<void> {
  const key = ownerWallet.toLowerCase();
  await prisma.entitlement.upsert({
    where: { ownerWallet: key },
    update: { consumed: { increment: units } },
    create: { ownerWallet: key, granted: 0, consumed: units },
  });
}
