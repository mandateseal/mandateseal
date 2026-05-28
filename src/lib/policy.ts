import type { ActionRequest } from "./schemas";
import {
  HIGH_RISK_KEYWORDS,
  MAX_UINT256_STR,
  KNOWN_SAFE_SELECTORS,
  ERC20_APPROVE_SELECTOR,
} from "./constants";

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
  // v0.2 — wallet mandate. toMandateSnapshot always populates these with
  // safe defaults so consumers don't need to null-check; legacy snapshots
  // (e.g. raw JSON from old receipts) may have them undefined, hence the
  // defensive checks in the policy engine.
  agentWallet: string | null;
  ownerWallet: string | null;
  allowedChains: string[];
  allowedTokens: string[];
  allowedContracts: string[];
  blockedContracts: string[];
  blockedRecipients: string[];
  maxTxValueUsd: number;
  dailyTokenSpendUsd: number;
  requireApprovalForSwaps: boolean;
  requireApprovalForTransfers: boolean;
  // v0.4 — operator-controlled public exposure policy. Not consumed by the
  // policy engine; carried on the snapshot so it's available downstream.
  publicFields: string[] | null;
}

export interface PolicyDecision {
  decision: Decision;
  reason: string;
  matchedRule: string;
  riskLevel: RiskLevel;
}

function domainOf(target: string): string | null {
  if (!target) return null;
  // v0.2 — 0x-addresses, chain names, and bare tx hashes aren't web hosts.
  // Treat them as non-domains so allowedDomains/blockedDomains don't fire
  // on crypto targets.
  if (/^0x[0-9a-fA-F]{40}$/.test(target)) return null;
  if (/^0x[0-9a-fA-F]{64}$/.test(target)) return null;
  if (/^[a-z]+(-[a-z0-9]+)*$/i.test(target) && !target.includes(".")) {
    // chain slug ("base", "base-sepolia", "ethereum") — no dot ⇒ not a host
    return null;
  }
  try {
    if (/^https?:\/\//i.test(target)) return new URL(target).hostname.toLowerCase();
  } catch {
    /* fall through */
  }
  const stripped = target.replace(/^[a-z]+:\/\//i, "").replace(/^[a-z]+:/i, "");
  const hostPart = stripped.split("/")[0].split("?")[0].toLowerCase().trim();
  return hostPart || null;
}

function listed(list: string[], v: string): boolean {
  return list.some((x) => x.toLowerCase() === v.toLowerCase());
}

function isInfiniteApproval(amount: string | undefined): boolean {
  if (!amount) return false;
  const trimmed = amount.trim();
  if (trimmed.length === 0) return false;
  // String-compare against max uint256 — avoids BigInt parsing edge cases
  // for non-decimal inputs while staying safe for huge values.
  if (trimmed.length > MAX_UINT256_STR.length) return true;
  if (trimmed.length === MAX_UINT256_STR.length && trimmed >= MAX_UINT256_STR) return true;
  // Also catch the common "uint256.max" shorthand callers sometimes pass.
  return /^max$|^infinite$|^uint256\.?max$/i.test(trimmed);
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

  // v0.2 — crypto fields (all optional on the action).
  const chain = action.chain;
  const token = action.token;
  const recipient = action.recipient;
  const contractAddress = action.contractAddress;
  const functionSelector = action.functionSelector;
  const txValueUsd = action.txValueUsd ?? 0;
  const amount = action.amount;

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

  // --- v0.2 crypto rules (only fire when relevant fields are present) ----

  // C1. blockedRecipients ∋ recipient.
  if (recipient && (mandate.blockedRecipients?.length ?? 0) > 0 && listed(mandate.blockedRecipients!, recipient)) {
    return {
      decision: "BLOCKED",
      reason: `Recipient "${recipient}" is on the mandate's block list.`,
      matchedRule: `blockedRecipients ∋ "${recipient}"`,
      riskLevel: "HIGH",
    };
  }

  // C2. blockedContracts ∋ contractAddress.
  if (contractAddress && (mandate.blockedContracts?.length ?? 0) > 0 && listed(mandate.blockedContracts!, contractAddress)) {
    return {
      decision: "BLOCKED",
      reason: `Contract "${contractAddress}" is on the mandate's block list.`,
      matchedRule: `blockedContracts ∋ "${contractAddress}"`,
      riskLevel: "HIGH",
    };
  }

  // C3. allowedChains non-empty and chain not in list.
  if (chain && (mandate.allowedChains?.length ?? 0) > 0 && !listed(mandate.allowedChains!, chain)) {
    return {
      decision: "BLOCKED",
      reason: `Chain "${chain}" is not in the mandate's allow list.`,
      matchedRule: `allowedChains ∌ "${chain}"`,
      riskLevel: "MEDIUM",
    };
  }

  // C4. allowedTokens non-empty and token not in list.
  if (token && (mandate.allowedTokens?.length ?? 0) > 0 && !listed(mandate.allowedTokens!, token)) {
    return {
      decision: "BLOCKED",
      reason: `Token "${token}" is not in the mandate's allow list.`,
      matchedRule: `allowedTokens ∌ "${token}"`,
      riskLevel: "MEDIUM",
    };
  }

  // C5. txValueUsd over max.
  if (txValueUsd > 0 && (mandate.maxTxValueUsd ?? 0) > 0 && txValueUsd > mandate.maxTxValueUsd!) {
    return {
      decision: "BLOCKED",
      reason: `Tx value $${txValueUsd.toFixed(2)} exceeds maxTxValueUsd $${mandate.maxTxValueUsd!.toFixed(2)}.`,
      matchedRule: `txValueUsd > maxTxValueUsd`,
      riskLevel: "HIGH",
    };
  }

  // C6. Infinite approval blocked outright.
  const isApproval =
    actionType === "token_approval" ||
    (functionSelector && functionSelector.toLowerCase() === ERC20_APPROVE_SELECTOR);
  if (isApproval && isInfiniteApproval(amount)) {
    return {
      decision: "BLOCKED",
      reason: `Infinite token approval blocked. Use a finite amount.`,
      matchedRule: `infiniteApproval`,
      riskLevel: "HIGH",
    };
  }

  // C7. allowedContracts non-empty and contractAddress not in list.
  // We treat this like allowedDomains — opt-in narrow whitelist.
  if (
    contractAddress &&
    (mandate.allowedContracts?.length ?? 0) > 0 &&
    !listed(mandate.allowedContracts!, contractAddress)
  ) {
    return {
      decision: "BLOCKED",
      reason: `Contract "${contractAddress}" is not in the mandate's allow list.`,
      matchedRule: `allowedContracts ∌ "${contractAddress}"`,
      riskLevel: "HIGH",
    };
  }

  // --- Universal cost / target rules continue ------------------------------

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

  // 7. Approval-required actions (explicit list).
  if (listed(mandate.approvalRequiredActions, actionType)) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Action "${actionType}" requires human approval.`,
      matchedRule: `approvalRequiredActions ∋ "${actionType}"`,
      riskLevel: "MEDIUM",
    };
  }

  // --- v0.2 crypto approval-required rules ---------------------------------

  // C8. Swap requires approval.
  if (actionType === "token_swap" && mandate.requireApprovalForSwaps) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Token swap requires human approval.`,
      matchedRule: `requireApprovalForSwaps`,
      riskLevel: "MEDIUM",
    };
  }

  // C9. Transfer requires approval.
  if (
    (actionType === "transfer_usdc" || actionType === "bridge_transfer") &&
    mandate.requireApprovalForTransfers
  ) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Token transfer requires human approval.`,
      matchedRule: `requireApprovalForTransfers`,
      riskLevel: "MEDIUM",
    };
  }

  // C10. Contract call with unknown selector → NEEDS_APPROVAL.
  // Only fires when the call is otherwise allowed (contract whitelisted or
  // no whitelist). Lets the operator preview new methods before flipping
  // them to auto-approve.
  if (
    actionType === "contract_call" &&
    functionSelector &&
    !KNOWN_SAFE_SELECTORS.has(functionSelector.toLowerCase())
  ) {
    return {
      decision: "NEEDS_APPROVAL",
      reason: `Contract call uses unknown function selector ${functionSelector}.`,
      matchedRule: `unknownSelector`,
      riskLevel: "HIGH",
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
