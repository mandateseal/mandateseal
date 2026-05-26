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
  };
}

export function serializeListsForDb(input: Partial<{
  allowedTools: string[];
  blockedTools: string[];
  blockedActions: string[];
  approvalRequiredActions: string[];
  allowedDomains: string[];
  blockedDomains: string[];
}>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of [
    "allowedTools",
    "blockedTools",
    "blockedActions",
    "approvalRequiredActions",
    "allowedDomains",
    "blockedDomains",
  ] as const) {
    if (input[k] !== undefined) out[k] = JSON.stringify(input[k]);
  }
  return out;
}
