import type { Approval, Receipt } from "@prisma/client";
import { prisma } from "./db";
import { randomId } from "./crypto";
import { emit as emitWebhook } from "./webhook";

export const DEFAULT_TTL_SECONDS = 60 * 30; // 30 minutes

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired";

export interface ApprovalView {
  id: string;
  receiptId: string;
  agentId: string;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  expiresAt: string;
}

export interface ApprovalListItem extends ApprovalView {
  receipt: {
    id: string;
    actionType: string;
    tool: string;
    target: string;
    costUsd: number;
    decision: string;
    reason: string;
    matchedRule: string;
    riskLevel: string;
    timestamp: string;
  };
}

export function toApprovalView(a: Approval): ApprovalView {
  return {
    id: a.id,
    receiptId: a.receiptId,
    agentId: a.agentId,
    status: a.status as ApprovalStatus,
    requestedAt: a.requestedAt.toISOString(),
    decidedAt: a.decidedAt?.toISOString() ?? null,
    decidedBy: a.decidedBy,
    decisionNote: a.decisionNote,
    expiresAt: a.expiresAt.toISOString(),
  };
}

export function toApprovalListItem(a: Approval & { receipt: Receipt }): ApprovalListItem {
  return {
    ...toApprovalView(a),
    receipt: {
      id: a.receipt.id,
      actionType: a.receipt.actionType,
      tool: a.receipt.tool,
      target: a.receipt.target,
      costUsd: a.receipt.costUsd,
      decision: a.receipt.decision,
      reason: a.receipt.reason,
      matchedRule: a.receipt.matchedRule,
      riskLevel: a.receipt.riskLevel,
      timestamp: a.receipt.timestamp.toISOString(),
    },
  };
}

/** Lazy TTL expiry for a single approval. Returns the (possibly updated) row. */
export async function expireIfDue(a: Approval): Promise<Approval> {
  if (a.status !== "pending") return a;
  if (a.expiresAt.getTime() > Date.now()) return a;
  return prisma.approval.update({
    where: { id: a.id },
    data: {
      status: "expired",
      decidedAt: new Date(),
      decidedBy: "system",
      decisionNote: "TTL expired",
    },
  });
}

/** Bulk-expire every pending approval whose TTL has passed. Cheap to call on every list-style read. */
export async function expireAllOverdue(): Promise<number> {
  const overdue = await prisma.approval.findMany({
    where: { status: "pending", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  if (overdue.length === 0) return 0;
  const res = await prisma.approval.updateMany({
    where: { id: { in: overdue.map((o) => o.id) } },
    data: {
      status: "expired",
      decidedAt: new Date(),
      decidedBy: "system",
      decisionNote: "TTL expired",
    },
  });
  return res.count;
}

export async function createPendingApproval(args: {
  receiptId: string;
  agentId: string;
  ttlSeconds?: number;
}): Promise<Approval> {
  const ttl = args.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  return prisma.approval.create({
    data: {
      id: randomId("appr"),
      receiptId: args.receiptId,
      agentId: args.agentId,
      status: "pending",
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });
}

/**
 * Resolve a pending approval. Handles TTL expiry, conflict detection, and the
 * actual status flip in one place so /approve and /deny stay thin wrappers.
 */
export async function decideApproval(args: {
  id: string;
  status: "approved" | "denied";
  decidedBy: string;
  decisionNote?: string | null;
}): Promise<
  | { ok: true; approval: Approval }
  | { ok: false; status: number; error: string }
> {
  const existing = await prisma.approval.findUnique({ where: { id: args.id } });
  if (!existing) return { ok: false, status: 404, error: "Approval not found" };

  const fresh = await expireIfDue(existing);
  if (fresh.status !== "pending") {
    return { ok: false, status: 409, error: `Already resolved as ${fresh.status}` };
  }

  const updated = await prisma.approval.update({
    where: { id: args.id },
    data: {
      status: args.status,
      decidedAt: new Date(),
      decidedBy: args.decidedBy,
      decisionNote: args.decisionNote ?? null,
    },
  });
  void emitWebhook("approval.decided", { approval: toApprovalView(updated) });
  return { ok: true, approval: updated };
}
