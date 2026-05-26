import type { ActionRequest } from "./schemas";
import { HIGH_RISK_KEYWORDS } from "./constants";

export type Decision = "APPROVED" | "BLOCKED" | "NEEDS_APPROVAL";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface MandateSnapshot {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  dailyBudgetUsd: number;
  maxCostPerActionUsd: number;
  approvalThresholdUsd: number;
  allowedTools: string[];
  blockedTools: string[];
  blockedActions: string[];
  approvalRequiredActions: string[];
  allowedDomains: string[];
  blockedDomains: string[];
}

export interface PolicyDecision {
  decision: Decision;
  reason: string;
  matchedRule: string;
  riskLevel: RiskLevel;
}

function domainOf(target: string): string | null {
  if (!target) return null;
  try {
    if (/^https?:\/\//i.test(target)) return new URL(target).hostname.toLowerCase();
  } catch {
    /* fall through */
  }
  // Bare host or "mail:..." style targets — strip scheme prefix if present.
  const stripped = target.replace(/^[a-z]+:\/\//i, "").replace(/^[a-z]+:/i, "");
  const hostPart = stripped.split("/")[0].split("?")[0].toLowerCase().trim();
  return hostPart || null;
}

function listed(list: string[], v: string): boolean {
  return list.some((x) => x.toLowerCase() === v.toLowerCase());
}

export function evaluatePolicy(
  action: ActionRequest,
  mandate: MandateSnapshot,
): PolicyDecision {
  const tool = action.tool;
  const actionType = action.actionType;
  const target = action.target ?? "";
  const cost = action.costUsd ?? 0;
  const domain = domainOf(target);

  // 1. Mandate disabled → permissive APPROVED.
  if (!mandate.enabled) {
    return {
      decision: "APPROVED",
      reason: "Mandate is disabled, no policy enforced.",
      matchedRule: "mandate.enabled = false",
      riskLevel: "LOW",
    };
  }

  // 2. blockedTools.
  if (listed(mandate.blockedTools, tool)) {
    return {
      decision: "BLOCKED",
      reason: `Tool "${tool}" is on the mandate's block list.`,
      matchedRule: `blockedTools ∋ "${tool}"`,
      riskLevel: deriveRisk("BLOCKED", tool, actionType, domain, mandate),
    };
  }

  // 3. blockedActions.
  if (listed(mandate.blockedActions, actionType)) {
    return {
      decision: "BLOCKED",
      reason: `Action "${actionType}" is on the mandate's block list.`,
      matchedRule: `blockedActions ∋ "${actionType}"`,
      riskLevel: deriveRisk("BLOCKED", tool, actionType, domain, mandate),
    };
  }

  // 4. blockedDomains.
  if (domain && listed(mandate.blockedDomains, domain)) {
    return {
      decision: "BLOCKED",
      reason: `Target domain "${domain}" is on the mandate's block list.`,
      matchedRule: `blockedDomains ∋ "${domain}"`,
      riskLevel: "HIGH",
    };
  }

  // 5. Cost over max per action.
  if (cost > mandate.maxCostPerActionUsd) {
    return {
      decision: "BLOCKED",
      reason: `Cost $${cost.toFixed(2)} exceeds max per-action limit $${mandate.maxCostPerActionUsd.toFixed(2)}.`,
      matchedRule: `costUsd > maxCostPerActionUsd`,
      riskLevel: "MEDIUM",
    };
  }

  // 6. Cost above approval threshold.
  if (cost > mandate.approvalThresholdUsd) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Cost $${cost.toFixed(2)} exceeds approval threshold $${mandate.approvalThresholdUsd.toFixed(2)}.`,
      matchedRule: `costUsd > approvalThresholdUsd`,
      riskLevel: "MEDIUM",
    };
  }

  // 7. Approval-required actions.
  if (listed(mandate.approvalRequiredActions, actionType)) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Action "${actionType}" requires human approval.`,
      matchedRule: `approvalRequiredActions ∋ "${actionType}"`,
      riskLevel: "MEDIUM",
    };
  }

  // 8. allowedTools non-empty and tool not in list.
  if (mandate.allowedTools.length > 0 && !listed(mandate.allowedTools, tool)) {
    return {
      decision: "BLOCKED",
      reason: `Tool "${tool}" is not in the mandate's allow list.`,
      matchedRule: `allowedTools ∌ "${tool}"`,
      riskLevel: deriveRisk("BLOCKED", tool, actionType, domain, mandate),
    };
  }

  // 9. allowedDomains non-empty and domain not in list.
  if (domain && mandate.allowedDomains.length > 0 && !listed(mandate.allowedDomains, domain)) {
    return {
      decision: "BLOCKED",
      reason: `Target domain "${domain}" is not in the mandate's allow list.`,
      matchedRule: `allowedDomains ∌ "${domain}"`,
      riskLevel: "MEDIUM",
    };
  }

  // 10. Default — APPROVED.
  return {
    decision: "APPROVED",
    reason: "Action satisfies the mandate.",
    matchedRule: "default.allow",
    riskLevel: "LOW",
  };
}

function deriveRisk(
  decision: Decision,
  tool: string,
  actionType: string,
  domain: string | null,
  mandate: MandateSnapshot,
): RiskLevel {
  if (decision === "BLOCKED") {
    const haystack = `${tool} ${actionType}`.toLowerCase();
    if (HIGH_RISK_KEYWORDS.some((k) => haystack.includes(k))) return "HIGH";
    if (domain && listed(mandate.blockedDomains, domain)) return "HIGH";
    return "MEDIUM";
  }
  if (decision === "NEEDS_APPROVAL") return "MEDIUM";
  return "LOW";
}
