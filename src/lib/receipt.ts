import { prisma } from "./db";
import { hashCanonical, signHex, randomId } from "./crypto";
import { toMandateSnapshot } from "./mandate";
import { evaluatePolicy, type PolicyDecision } from "./policy";
import type { ActionRequest } from "./schemas";

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
}

/**
 * Run the policy engine for an action and persist a signed receipt.
 * Returns the decision plus the saved receipt.
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
  const decision = evaluatePolicy(action, snapshot);

  const id = randomId("rct");
  const timestamp = new Date().toISOString();

  const rawPayload: Record<string, unknown> = {
    actionType: action.actionType,
    tool: action.tool,
    target: action.target,
    costUsd: action.costUsd,
    metadata: action.metadata ?? null,
  };

  const policyHash = hashCanonical({
    mandate: snapshot,
    action: rawPayload,
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
  const signature = signHex({ ...unsignedReceipt, receiptHash });

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

  return {
    ...unsignedReceipt,
    receiptHash,
    signature,
  };
}

export function recomputeAndVerify(receipt: {
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
  rawPayload?: Record<string, unknown>;
}): { valid: boolean; reasons: string[]; expectedReceiptHash: string; expectedSignature: string } {
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
  const expectedSignature = signHex({ ...unsigned, receiptHash: expectedReceiptHash });
  if (expectedSignature !== receipt.signature) {
    reasons.push("signature does not match expected HMAC-SHA256");
  }
  return {
    valid: reasons.length === 0,
    reasons,
    expectedReceiptHash,
    expectedSignature,
  };
}
