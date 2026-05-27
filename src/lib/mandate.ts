import type { Mandate } from "@prisma/client";
import type { MandateSnapshot } from "./policy";

function parseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function toMandateSnapshot(m: Mandate): MandateSnapshot {
  return {
    id: m.id,
    agentId: m.agentId,
    name: m.name,
    enabled: m.enabled,
    dailyBudgetUsd: m.dailyBudgetUsd,
    maxCostPerActionUsd: m.maxCostPerActionUsd,
    approvalThresholdUsd: m.approvalThresholdUsd,
    allowedTools: parseList(m.allowedTools),
    blockedTools: parseList(m.blockedTools),
    blockedActions: parseList(m.blockedActions),
    approvalRequiredActions: parseList(m.approvalRequiredActions),
    allowedDomains: parseList(m.allowedDomains),
    blockedDomains: parseList(m.blockedDomains),
    // v0.2 — wallet mandate fields.
    agentWallet: m.agentWallet ?? null,
    ownerWallet: m.ownerWallet ?? null,
    allowedChains: parseList(m.allowedChains ?? "[]"),
    allowedTokens: parseList(m.allowedTokens ?? "[]"),
    allowedContracts: parseList(m.allowedContracts ?? "[]"),
    blockedContracts: parseList(m.blockedContracts ?? "[]"),
    blockedRecipients: parseList(m.blockedRecipients ?? "[]"),
    maxTxValueUsd: m.maxTxValueUsd ?? 0,
    dailyTokenSpendUsd: m.dailyTokenSpendUsd ?? 0,
    requireApprovalForSwaps: m.requireApprovalForSwaps ?? false,
    requireApprovalForTransfers: m.requireApprovalForTransfers ?? false,
  };
}

export function serializeListsForDb(input: Partial<{
  allowedTools: string[];
  blockedTools: string[];
  blockedActions: string[];
  approvalRequiredActions: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  allowedChains: string[];
  allowedTokens: string[];
  allowedContracts: string[];
  blockedContracts: string[];
  blockedRecipients: string[];
}>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of [
    "allowedTools",
    "blockedTools",
    "blockedActions",
    "approvalRequiredActions",
    "allowedDomains",
    "blockedDomains",
    "allowedChains",
    "allowedTokens",
    "allowedContracts",
    "blockedContracts",
    "blockedRecipients",
  ] as const) {
    if (input[k] !== undefined) out[k] = JSON.stringify(input[k]);
  }
  return out;
}
