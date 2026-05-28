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
  // v0.2 — optional crypto fields. Null on non-crypto receipts.
  chain: string | null;
  wallet: string | null;
  token: string | null;
  amount: string | null;
  txValueUsd: number | null;
  recipient: string | null;
  contractAddress: string | null;
  functionSelector: string | null;
  txHash: string | null;
  // v0.8 — outcome receipt fields. Null unless this row is the outcome
  // produced by a proxy call.
  preflightReceiptId: string | null;
  upstreamStatus: number | null;
  upstreamDurationMs: number | null;
  upstreamBytesIn: number | null;
  upstreamBytesOut: number | null;
  upstreamBodyHash: string | null;
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
 *
 * v0.4 — operator-controlled exposure. If a `publicFields` policy is passed
 * (parsed from Mandate.publicFields), fields outside the allowlist are
 * blanked. Fields that are part of the proof itself (id, hashes, signature,
 * decision, timestamp) are NEVER redacted — without them the receipt cannot
 * be verified and the page becomes useless.
 */
const ALWAYS_PUBLIC: ReadonlySet<keyof ReceiptView> = new Set([
  "id",
  "agentId",
  "decision",
  "timestamp",
  "policyHash",
  "receiptHash",
  "signature",
  "createdAt",
]);

export function redactedReceipt(
  view: ReceiptView,
  publicFields?: string[] | null,
): ReceiptView {
  // Default behavior (no policy set): hide rawPayload only — the pre-v0.4 redaction.
  if (!publicFields) {
    return { ...view, rawPayload: null };
  }

  const allow = new Set(publicFields);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(view) as Array<[keyof ReceiptView, unknown]>) {
    if (ALWAYS_PUBLIC.has(k) || allow.has(k as string)) {
      out[k] = v;
    } else {
      // Blank scalar fields, null nullable refs, null rawPayload.
      out[k] = k === "rawPayload" ? null : typeof v === "number" ? null : null;
    }
  }
  // costUsd is non-nullable in the type — restore 0 when redacted so the
  // shape stays valid for ReceiptCard rendering.
  if (typeof out.costUsd !== "number") out.costUsd = 0;
  if (out.reason === null) out.reason = "(redacted)";
  if (out.matchedRule === null) out.matchedRule = "(redacted)";
  if (out.riskLevel === null) out.riskLevel = view.riskLevel;
  if (out.actionType === null) out.actionType = "(redacted)";
  if (out.tool === null) out.tool = "(redacted)";
  if (out.target === null) out.target = "(redacted)";
  if (out.mandateId === null) out.mandateId = "(redacted)";
  return out as unknown as ReceiptView;
}

/** Parse the Mandate.publicFields JSON column safely. */
export function parsePublicFields(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
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
    chain: r.chain ?? null,
    wallet: r.wallet ?? null,
    token: r.token ?? null,
    amount: r.amount ?? null,
    txValueUsd: r.txValueUsd ?? null,
    recipient: r.recipient ?? null,
    contractAddress: r.contractAddress ?? null,
    functionSelector: r.functionSelector ?? null,
    txHash: r.txHash ?? null,
    preflightReceiptId: r.preflightReceiptId ?? null,
    upstreamStatus: r.upstreamStatus ?? null,
    upstreamDurationMs: r.upstreamDurationMs ?? null,
    upstreamBytesIn: r.upstreamBytesIn ?? null,
    upstreamBytesOut: r.upstreamBytesOut ?? null,
    upstreamBodyHash: r.upstreamBodyHash ?? null,
  };
}
