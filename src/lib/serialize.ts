import type { Agent, Mandate, Receipt } from "@prisma/client";
import { toMandateSnapshot } from "./mandate";
import type { Decision, RiskLevel } from "./policy";

export interface ReceiptView {
  id: string;
  agentId: string;
  mandateId: string;
  actionType: string;
  tool: string;
  target: string;
  costUsd: number;
  decision: Decision;
  reason: string;
  matchedRule: string;
  riskLevel: RiskLevel;
  timestamp: string;
  policyHash: string;
  receiptHash: string;
  signature: string;
  rawPayload: Record<string, unknown> | null;
  createdAt: string;
}

export function publicAgent(a: Agent) {
  return {
    id: a.id,
    name: a.name,
    role: a.role,
    status: a.status,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}

export function publicMandate(m: Mandate) {
  const snap = toMandateSnapshot(m);
  return {
    ...snap,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

/**
 * Strip sensitive sub-payloads from a receipt for public exposure (/r/:id,
 * /a/:id, OG previews). The top-level decision, agent id, hashes and signature
 * still serve as proof — verification by id still works against the server's
 * stored full payload via /api/verify. Offline verification on a redacted
 * payload would fail by design (the canonical hash is over the FULL receipt).
 */
export function redactedReceipt(view: ReceiptView): ReceiptView {
  return {
    ...view,
    rawPayload: null,
  };
}

export function publicReceipt(r: Receipt): ReceiptView {
  let rawPayload: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(r.rawPayload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      rawPayload = parsed as Record<string, unknown>;
    }
  } catch {
    rawPayload = null;
  }
  return {
    id: r.id,
    agentId: r.agentId,
    mandateId: r.mandateId,
    actionType: r.actionType,
    tool: r.tool,
    target: r.target,
    costUsd: r.costUsd,
    decision: r.decision as Decision,
    reason: r.reason,
    matchedRule: r.matchedRule,
    riskLevel: r.riskLevel as RiskLevel,
    timestamp: r.timestamp.toISOString(),
    policyHash: r.policyHash,
    receiptHash: r.receiptHash,
    signature: r.signature,
    rawPayload,
    createdAt: r.createdAt.toISOString(),
  };
}
