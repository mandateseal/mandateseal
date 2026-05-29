import { prisma } from "./db";
import { hashCanonical, signReceipt, verifyReceipt, randomId } from "./crypto";
import { toMandateSnapshot } from "./mandate";
import { evaluatePolicy, type MandateSnapshot, type PolicyDecision } from "./policy";
import type { ActionRequest } from "./schemas";
import { createPendingApproval, toApprovalView, type ApprovalView } from "./approval";
import {
  sumApprovedCost,
  sumApprovedTxValue,
  startOfTodayUtc,
  enforceDailyBudget,
  enforceDailyTokenSpend,
} from "./spend";
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
  // v0.2 — optional crypto fields. Null on non-crypto actions. Always
  // included in rawPayload too so the canonical hash already covers them.
  chain?: string | null;
  wallet?: string | null;
  token?: string | null;
  amount?: string | null;
  txValueUsd?: number | null;
  recipient?: string | null;
  contractAddress?: string | null;
  functionSelector?: string | null;
  txHash?: string | null;
  // v0.8 — outcome receipt fields. Present only on receipts produced by
  // `sealOutcomeReceipt` after a proxy call returns. The preflight pair is
  // identified by preflightReceiptId.
  preflightReceiptId?: string | null;
  upstreamStatus?: number | null;
  upstreamDurationMs?: number | null;
  upstreamBytesIn?: number | null;
  upstreamBytesOut?: number | null;
  upstreamBodyHash?: string | null;
}

/**
 * v0.8.1 — idempotency conflict. Thrown when the caller reuses an
 * Idempotency-Key with a different request body. The route layer catches
 * this and maps it to HTTP 409.
 */
export class IdempotencyConflictError extends Error {
  constructor(public readonly agentId: string, public readonly key: string) {
    super(`Idempotency-Key "${key}" already used for agent ${agentId} with a different request`);
    this.name = "IdempotencyConflictError";
  }
}

function fromPersistedReceipt(r: {
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
  timestamp: Date;
  policyHash: string;
  receiptHash: string;
  signature: string;
  rawPayload: string;
  chain: string | null;
  wallet: string | null;
  token: string | null;
  amount: string | null;
  txValueUsd: number | null;
  recipient: string | null;
  contractAddress: string | null;
  functionSelector: string | null;
  txHash: string | null;
}): ReceiptRecord {
  let parsed: Record<string, unknown> = {};
  try {
    const j = JSON.parse(r.rawPayload);
    if (j && typeof j === "object" && !Array.isArray(j)) parsed = j as Record<string, unknown>;
  } catch {
    /* keep empty */
  }
  return {
    id: r.id,
    agentId: r.agentId,
    mandateId: r.mandateId,
    actionType: r.actionType,
    tool: r.tool,
    target: r.target,
    costUsd: r.costUsd,
    decision: r.decision as PolicyDecision["decision"],
    reason: r.reason,
    matchedRule: r.matchedRule,
    riskLevel: r.riskLevel as PolicyDecision["riskLevel"],
    timestamp: r.timestamp.toISOString(),
    policyHash: r.policyHash,
    receiptHash: r.receiptHash,
    signature: r.signature,
    rawPayload: parsed,
    approval: null,
    chain: r.chain,
    wallet: r.wallet,
    token: r.token,
    amount: r.amount,
    txValueUsd: r.txValueUsd,
    recipient: r.recipient,
    contractAddress: r.contractAddress,
    functionSelector: r.functionSelector,
    txHash: r.txHash,
  };
}

function cryptoFieldsOf(action: ActionRequest): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (action.chain !== undefined) out.chain = action.chain;
  if (action.wallet !== undefined) out.wallet = action.wallet;
  if (action.token !== undefined) out.token = action.token;
  if (action.amount !== undefined) out.amount = action.amount;
  if (action.txValueUsd !== undefined) out.txValueUsd = action.txValueUsd;
  if (action.recipient !== undefined) out.recipient = action.recipient;
  if (action.contractAddress !== undefined) out.contractAddress = action.contractAddress;
  if (action.functionSelector !== undefined) out.functionSelector = action.functionSelector;
  if (action.txHash !== undefined) out.txHash = action.txHash;
  return out;
}

/**
 * Run the policy engine for an action and persist a signed receipt.
 *
 * The mandate snapshot used for the decision is included in rawPayload so an
 * auditor can reproduce the verdict even after the live mandate has been edited.
 *
 * v0.8.1 — accepts optional `idempotencyKey` + `requestHash`. When the
 * same (agentId, key) appears with the same request hash, the prior sealed
 * receipt is returned verbatim (no re-evaluation, no DB write). A key reuse
 * with a different hash throws IdempotencyConflictError.
 */
export async function evaluateAndSeal(
  action: ActionRequest,
  opts: { idempotencyKey?: string | null; requestHash?: string | null } = {},
): Promise<ReceiptRecord> {
  const result = await evaluateAndSealWithMeta(action, opts);
  return result.receipt;
}

/**
 * Same as evaluateAndSeal but also reports whether the response came from
 * the idempotency cache. Proxy + MCP routes use this so they can skip the
 * upstream call on a replay hit.
 */
export async function evaluateAndSealWithMeta(
  action: ActionRequest,
  opts: { idempotencyKey?: string | null; requestHash?: string | null } = {},
): Promise<{ receipt: ReceiptRecord; cached: boolean }> {
  // v0.8.1 — idempotency replay check. Done BEFORE policy evaluation so a
  // retry costs only one DB read.
  if (opts.idempotencyKey) {
    const existing = await prisma.receipt.findUnique({
      where: {
        agentId_idempotencyKey: {
          agentId: action.agentId,
          idempotencyKey: opts.idempotencyKey,
        },
      },
    });
    if (existing) {
      if (existing.requestHash && opts.requestHash && existing.requestHash !== opts.requestHash) {
        throw new IdempotencyConflictError(action.agentId, opts.idempotencyKey);
      }
      return { receipt: fromPersistedReceipt(existing), cached: true };
    }
  }

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

  // v0.8.2 — daily token-spend enforcement (post-engine, requires DB
  // aggregation). Bounds total onchain value moved per UTC day — the natural
  // ceiling for batch payouts. Same skip logic as the budget rule: only when
  // still APPROVED, a cap is set, and this action actually moves value.
  if (
    decision.decision === "APPROVED" &&
    snapshot.dailyTokenSpendUsd > 0 &&
    (action.txValueUsd ?? 0) > 0
  ) {
    const todayTokenUsd = await sumApprovedTxValue({
      agentId: action.agentId,
      from: startOfTodayUtc(),
    });
    decision = enforceDailyTokenSpend(decision, action, snapshot, todayTokenUsd);
  }

  // v0.8.1 — per-tool daily quota. Only checks when the action targets a
  // registered Tool with quotaPerDay set, and the base decision is still
  // APPROVED. Cheap COUNT, indexed by (agentId, timestamp).
  if (decision.decision === "APPROVED") {
    const tool = await prisma.tool.findFirst({
      where: { name: action.tool, enabled: true, quotaPerDay: { not: null } },
      select: { id: true, name: true, quotaPerDay: true },
    });
    if (tool?.quotaPerDay) {
      const usedToday = await prisma.receipt.count({
        where: {
          agentId: action.agentId,
          tool: tool.name,
          decision: "APPROVED",
          timestamp: { gte: startOfTodayUtc() },
        },
      });
      if (usedToday >= tool.quotaPerDay) {
        decision = {
          decision: "BLOCKED",
          reason: `Tool "${tool.name}" daily quota ${tool.quotaPerDay} reached (used ${usedToday}).`,
          matchedRule: `tool.quotaPerDay`,
          riskLevel: "MEDIUM",
        };
      }
    }
  }

  const id = randomId("rct");
  const timestamp = new Date().toISOString();

  const crypto = cryptoFieldsOf(action);

  const rawPayload: Record<string, unknown> = {
    actionType: action.actionType,
    tool: action.tool,
    target: action.target,
    costUsd: action.costUsd,
    metadata: action.metadata ?? null,
    mandateSnapshot: snapshot,
    ...(Object.keys(crypto).length > 0 ? { crypto } : {}),
  };

  const policyHash = hashCanonical({
    mandate: snapshot,
    action: {
      actionType: action.actionType,
      tool: action.tool,
      target: action.target,
      costUsd: action.costUsd,
      metadata: action.metadata ?? null,
      ...(Object.keys(crypto).length > 0 ? { crypto } : {}),
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
      // v0.2 — denormalize crypto fields onto the row for indexable filters
      // (chain/token/recipient/contractAddress) without parsing rawPayload.
      chain: action.chain ?? null,
      wallet: action.wallet ?? null,
      token: action.token ?? null,
      amount: action.amount ?? null,
      txValueUsd: action.txValueUsd ?? null,
      recipient: action.recipient ?? null,
      contractAddress: action.contractAddress ?? null,
      functionSelector: action.functionSelector ?? null,
      txHash: action.txHash ?? null,
      idempotencyKey: opts.idempotencyKey ?? null,
      requestHash: opts.requestHash ?? null,
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

  const sealedReceipt: ReceiptRecord = {
    ...unsignedReceipt,
    receiptHash,
    signature,
    approval,
    chain: action.chain ?? null,
    wallet: action.wallet ?? null,
    token: action.token ?? null,
    amount: action.amount ?? null,
    txValueUsd: action.txValueUsd ?? null,
    recipient: action.recipient ?? null,
    contractAddress: action.contractAddress ?? null,
    functionSelector: action.functionSelector ?? null,
    txHash: action.txHash ?? null,
  };

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

  return { receipt: sealedReceipt, cached: false };
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

/**
 * v0.8 — seal an outcome receipt for a proxy/tool call that already produced
 * a preflight receipt. The outcome receipt is a second sealed row covering
 * what the upstream actually returned (status, latency, byte counts, body
 * hash). It is canonically hashed + Ed25519-signed exactly like the preflight,
 * so a third party can independently verify "yes, MandateSeal saw this exact
 * response from this exact tool at this exact time".
 *
 * Closes the "Prove after" half of the lifecycle: the preflight proves the
 * policy decision; this proves the execution.
 */
export async function sealOutcomeReceipt(args: {
  preflight: ReceiptRecord;
  upstreamStatus: number;
  upstreamDurationMs: number;
  upstreamBytesIn: number;
  upstreamBytesOut: number;
  upstreamBodyHash: string;
}): Promise<ReceiptRecord> {
  const { preflight } = args;
  const id = randomId("rct");
  const timestamp = new Date().toISOString();

  const outcome = {
    preflightReceiptId: preflight.id,
    upstreamStatus: args.upstreamStatus,
    upstreamDurationMs: args.upstreamDurationMs,
    upstreamBytesIn: args.upstreamBytesIn,
    upstreamBytesOut: args.upstreamBytesOut,
    upstreamBodyHash: args.upstreamBodyHash,
  };

  const rawPayload: Record<string, unknown> = {
    actionType: "tool_call.outcome",
    tool: preflight.tool,
    target: preflight.target,
    costUsd: 0,
    metadata: { preflightReceiptId: preflight.id },
    outcome,
  };

  const policyHash = hashCanonical({
    action: {
      actionType: "tool_call.outcome",
      tool: preflight.tool,
      target: preflight.target,
      costUsd: 0,
    },
    outcome,
  });

  const reason = `Upstream returned ${args.upstreamStatus} in ${args.upstreamDurationMs}ms (${args.upstreamBytesIn}B in / ${args.upstreamBytesOut}B out)`;

  const unsigned = {
    id,
    agentId: preflight.agentId,
    mandateId: preflight.mandateId,
    actionType: "tool_call.outcome",
    tool: preflight.tool,
    target: preflight.target,
    costUsd: 0,
    decision: "APPROVED" as const,
    reason,
    matchedRule: "outcome.sealed",
    riskLevel: "LOW" as const,
    timestamp,
    policyHash,
    rawPayload,
  };
  const receiptHash = hashCanonical(unsigned);
  const signature = signReceipt({ ...unsigned, receiptHash });

  await prisma.receipt.create({
    data: {
      id,
      agentId: preflight.agentId,
      mandateId: preflight.mandateId,
      actionType: "tool_call.outcome",
      tool: preflight.tool,
      target: preflight.target,
      costUsd: 0,
      decision: "APPROVED",
      reason,
      matchedRule: "outcome.sealed",
      riskLevel: "LOW",
      timestamp: new Date(timestamp),
      policyHash,
      receiptHash,
      signature,
      rawPayload: JSON.stringify(rawPayload),
      preflightReceiptId: preflight.id,
      upstreamStatus: args.upstreamStatus,
      upstreamDurationMs: args.upstreamDurationMs,
      upstreamBytesIn: args.upstreamBytesIn,
      upstreamBytesOut: args.upstreamBytesOut,
      upstreamBodyHash: args.upstreamBodyHash,
    },
  });

  void emitWebhook("receipt.created", {
    receipt: { ...unsigned, receiptHash, signature, approval: null },
  });

  return {
    ...unsigned,
    receiptHash,
    signature,
    approval: null,
    preflightReceiptId: preflight.id,
    upstreamStatus: args.upstreamStatus,
    upstreamDurationMs: args.upstreamDurationMs,
    upstreamBytesIn: args.upstreamBytesIn,
    upstreamBytesOut: args.upstreamBytesOut,
    upstreamBodyHash: args.upstreamBodyHash,
  };
}

/** Re-evaluate a snapshot stored in rawPayload to ensure the decision was correct at sealing time. */
export function reEvaluateFromSnapshot(receipt: VerifyInput): {
  matched: boolean;
  expected: PolicyDecision | null;
} {
  const snapshot = (receipt.rawPayload as { mandateSnapshot?: MandateSnapshot } | null | undefined)?.mandateSnapshot;
  if (!snapshot) return { matched: true, expected: null };
  const crypto = (receipt.rawPayload as { crypto?: Record<string, unknown> } | null | undefined)?.crypto ?? {};
  const action = {
    agentId: receipt.agentId,
    actionType: receipt.actionType,
    tool: receipt.tool,
    target: receipt.target,
    costUsd: receipt.costUsd,
    ...crypto,
  };
  const expected = evaluatePolicy(action as unknown as ActionRequest, snapshot);
  const matched =
    expected.decision === receipt.decision &&
    expected.matchedRule === receipt.matchedRule &&
    expected.riskLevel === receipt.riskLevel;
  return { matched, expected };
}
