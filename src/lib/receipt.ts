import { prisma } from "./db";
import { hashCanonical, signReceipt, verifyReceipt, randomId } from "./crypto";
import { toMandateSnapshot } from "./mandate";
import { evaluatePolicy, type MandateSnapshot, type PolicyDecision } from "./policy";
import type { ActionRequest } from "./schemas";
import { createPendingApproval, toApprovalView, type ApprovalView } from "./approval";
import { sumApprovedCost, startOfTodayUtc, enforceDailyBudget } from "./spend";
import { emit as emitWebhook } from "./webhook";

export interface ReceiptRecord {
  id: string;
  agentId: string;
  mandateId: string;
  actionType: string;
  tool: string;
  target: string;
  costUsd: number;
  decision: PolicyDecision["decision"];
  reason: string;
  matchedRule: string;
  riskLevel: PolicyDecision["riskLevel"];
  timestamp: string;
  policyHash: string;
  receiptHash: string;
  signature: string;
  rawPayload: Record<string, unknown>;
  approval?: ApprovalView | null;
}

/**
 * Run the policy engine for an action and persist a signed receipt.
 *
 * The mandate snapshot used for the decision is included in rawPayload so an
 * auditor can reproduce the verdict even after the live mandate has been edited.
 */
export async function evaluateAndSeal(action: ActionRequest): Promise<ReceiptRecord> {
  const mandate = action.mandateId
    ? await prisma.mandate.findUnique({ where: { id: action.mandateId } })
    : await prisma.mandate.findFirst({
        where: { agentId: action.agentId, enabled: true },
        orderBy: { createdAt: "desc" },
      });

  if (!mandate) {
    throw new Error("No mandate found for agent. Create a mandate first.");
  }
  if (mandate.agentId !== action.agentId) {
    throw new Error("Mandate does not belong to the requesting agent.");
  }

  const snapshot = toMandateSnapshot(mandate);
  let decision = evaluatePolicy(action, snapshot);

  // v0.6 — daily budget enforcement (post-engine, requires DB aggregation).
  // Skip the aggregation when the base decision already rejects or the rule
  // cannot fire (no budget, no cost).
  if (
    decision.decision === "APPROVED" &&
    snapshot.dailyBudgetUsd > 0 &&
    action.costUsd > 0
  ) {
    const todayUsd = await sumApprovedCost({
      agentId: action.agentId,
      from: startOfTodayUtc(),
    });
    decision = enforceDailyBudget(decision, action, snapshot, todayUsd);
  }

  const id = randomId("rct");
  const timestamp = new Date().toISOString();

  const rawPayload: Record<string, unknown> = {
    actionType: action.actionType,
    tool: action.tool,
    target: action.target,
    costUsd: action.costUsd,
    metadata: action.metadata ?? null,
    mandateSnapshot: snapshot,
  };

  const policyHash = hashCanonical({
    mandate: snapshot,
    action: {
      actionType: action.actionType,
      tool: action.tool,
      target: action.target,
      costUsd: action.costUsd,
      metadata: action.metadata ?? null,
    },
    decision,
  });

  const unsignedReceipt = {
    id,
    agentId: action.agentId,
    mandateId: mandate.id,
    actionType: action.actionType,
    tool: action.tool,
    target: action.target,
    costUsd: action.costUsd,
    decision: decision.decision,
    reason: decision.reason,
    matchedRule: decision.matchedRule,
    riskLevel: decision.riskLevel,
    timestamp,
    policyHash,
    rawPayload,
  };

  const receiptHash = hashCanonical(unsignedReceipt);
  const signature = signReceipt({ ...unsignedReceipt, receiptHash });

  await prisma.receipt.create({
    data: {
      id,
      agentId: action.agentId,
      mandateId: mandate.id,
      actionType: action.actionType,
      tool: action.tool,
      target: action.target,
      costUsd: action.costUsd,
      decision: decision.decision,
      reason: decision.reason,
      matchedRule: decision.matchedRule,
      riskLevel: decision.riskLevel,
      timestamp: new Date(timestamp),
      policyHash,
      receiptHash,
      signature,
      rawPayload: JSON.stringify(rawPayload),
    },
  });

  // If the policy gate flagged this as NEEDS_APPROVAL, auto-open an approval
  // workflow so a human can resolve it. The receipt itself stays immutable;
  // the Approval record is the workflow state.
  let approval: ApprovalView | null = null;
  if (decision.decision === "NEEDS_APPROVAL") {
    const a = await createPendingApproval({ receiptId: id, agentId: action.agentId });
    approval = toApprovalView(a);
  }

  const sealedReceipt = { ...unsignedReceipt, receiptHash, signature, approval };

  // v0.8 — fan out webhooks. Detached: emit() persists delivery rows and runs
  // retries on its own; this function returns immediately.
  void emitWebhook("receipt.created", { receipt: sealedReceipt });
  if (decision.decision === "BLOCKED") {
    void emitWebhook("receipt.blocked", { receipt: sealedReceipt });
  }
  if (decision.decision === "NEEDS_APPROVAL") {
    void emitWebhook("receipt.needs_approval", { receipt: sealedReceipt });
    if (approval) void emitWebhook("approval.requested", { receipt: sealedReceipt, approval });
  }

  return sealedReceipt;
}

interface VerifyInput {
  id: string;
  agentId: string;
  mandateId: string;
  actionType: string;
  tool: string;
  target: string;
  costUsd: number;
  decision: string;
  reason: string;
  matchedRule: string;
  riskLevel: string;
  timestamp: string;
  policyHash: string;
  receiptHash: string;
  signature: string;
  rawPayload?: Record<string, unknown> | null;
}

export function recomputeAndVerify(receipt: VerifyInput): {
  valid: boolean;
  reasons: string[];
  expectedReceiptHash: string;
} {
  const reasons: string[] = [];
  const unsigned = {
    id: receipt.id,
    agentId: receipt.agentId,
    mandateId: receipt.mandateId,
    actionType: receipt.actionType,
    tool: receipt.tool,
    target: receipt.target,
    costUsd: receipt.costUsd,
    decision: receipt.decision,
    reason: receipt.reason,
    matchedRule: receipt.matchedRule,
    riskLevel: receipt.riskLevel,
    timestamp: receipt.timestamp,
    policyHash: receipt.policyHash,
    rawPayload: receipt.rawPayload ?? {},
  };
  const expectedReceiptHash = hashCanonical(unsigned);
  if (expectedReceiptHash !== receipt.receiptHash) {
    reasons.push("receiptHash does not match canonical payload");
  }
  const sigOk = verifyReceipt({ ...unsigned, receiptHash: expectedReceiptHash }, receipt.signature);
  if (!sigOk) {
    reasons.push("signature does not match Ed25519 public key");
  }
  return { valid: reasons.length === 0, reasons, expectedReceiptHash };
}

/** Re-evaluate a snapshot stored in rawPayload to ensure the decision was correct at sealing time. */
export function reEvaluateFromSnapshot(receipt: VerifyInput): {
  matched: boolean;
  expected: PolicyDecision | null;
} {
  const snapshot = (receipt.rawPayload as { mandateSnapshot?: MandateSnapshot } | null | undefined)?.mandateSnapshot;
  if (!snapshot) return { matched: true, expected: null };
  const action = {
    agentId: receipt.agentId,
    actionType: receipt.actionType,
    tool: receipt.tool,
    target: receipt.target,
    costUsd: receipt.costUsd,
  };
  const expected = evaluatePolicy(action as unknown as ActionRequest, snapshot);
  const matched =
    expected.decision === receipt.decision &&
    expected.matchedRule === receipt.matchedRule &&
    expected.riskLevel === receipt.riskLevel;
  return { matched, expected };
}
