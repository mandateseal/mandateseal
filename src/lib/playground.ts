// MandateSeal playground — scripted demo agent.
//
// Eight hand-tuned actions that an autonomous research agent might attempt.
// Each runs through the *real* policy engine + receipt sealer (Ed25519
// signature, canonical hash) but is NOT persisted to the database. The point
// is to show a visitor what MandateSeal does end-to-end in one page — without
// polluting the DB or burning rate limits on every page view.

import { hashCanonical, signReceipt, randomId } from "./crypto";
import { evaluatePolicy, type MandateSnapshot } from "./policy";
import type { ActionRequest } from "./schemas";
import { DEFAULT_AGENT, DEFAULT_MANDATE } from "./constants";
import type { ReceiptRecord } from "./receipt";

function demoSnapshot(): MandateSnapshot {
  return {
    id: DEFAULT_MANDATE.id,
    agentId: DEFAULT_AGENT.id,
    name: DEFAULT_MANDATE.name,
    enabled: DEFAULT_MANDATE.enabled,
    dailyBudgetUsd: DEFAULT_MANDATE.dailyBudgetUsd,
    maxCostPerActionUsd: DEFAULT_MANDATE.maxCostPerActionUsd,
    approvalThresholdUsd: DEFAULT_MANDATE.approvalThresholdUsd,
    allowedTools: DEFAULT_MANDATE.allowedTools,
    blockedTools: DEFAULT_MANDATE.blockedTools,
    blockedActions: DEFAULT_MANDATE.blockedActions,
    approvalRequiredActions: DEFAULT_MANDATE.approvalRequiredActions,
    allowedDomains: DEFAULT_MANDATE.allowedDomains,
    blockedDomains: DEFAULT_MANDATE.blockedDomains,
  };
}

export interface ScriptedAction {
  description: string;
  action: Omit<ActionRequest, "agentId">;
}

export const SCRIPT: ScriptedAction[] = [
  {
    description: "search github.com for autonomous-agent papers",
    action: { actionType: "search", tool: "web_search", target: "github.com", costUsd: 0.05 },
  },
  {
    description: "fetch OpenAI API docs",
    action: { actionType: "read", tool: "web_search", target: "api.openai.com", costUsd: 0.05 },
  },
  {
    description: "summarize a paper with paid_api_call",
    action: { actionType: "summarize", tool: "paid_api_call", target: "api.openai.com", costUsd: 1.2 },
  },
  {
    description: "draft a follow-up email to the author",
    action: { actionType: "send_email", tool: "email_draft", target: "author@example.com", costUsd: 0 },
  },
  {
    description: "buy a $4.99 paper dataset",
    action: { actionType: "buy_dataset", tool: "paid_api_call", target: "datasets.example.com", costUsd: 4.99 },
  },
  {
    description: "scrape unknown-wallet.site for token prices",
    action: { actionType: "read", tool: "web_search", target: "unknown-wallet.site", costUsd: 0.1 },
  },
  {
    description: "open a shell to clean up cache",
    action: { actionType: "execute_shell_command", tool: "shell_exec", target: "rm -rf /tmp/cache", costUsd: 0 },
  },
  {
    description: "transfer 50 USDC to a wallet",
    action: { actionType: "transfer_usdc", tool: "wallet_transfer", target: "0xabc...def", costUsd: 50 },
  },
];

export interface PlaygroundStep {
  step: number;
  description: string;
  receipt: ReceiptRecord;
}

/**
 * Run the entire script through the real policy engine + signer, in-memory.
 * Returns N sealed (but un-persisted) receipts in one call.
 */
export function runScript(): PlaygroundStep[] {
  const snapshot = demoSnapshot();
  const baseTime = Date.now() - SCRIPT.length * 1500;

  return SCRIPT.map((s, i) => {
    const action: ActionRequest = { ...s.action, agentId: DEFAULT_AGENT.id };
    const decision = evaluatePolicy(action, snapshot);

    const id = randomId("rct");
    // Stagger timestamps so the demo looks like a real run, not a single tick.
    const timestamp = new Date(baseTime + i * 1500).toISOString();

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

    const unsigned = {
      id,
      agentId: action.agentId,
      mandateId: snapshot.id,
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
    const receiptHash = hashCanonical(unsigned);
    const signature = signReceipt({ ...unsigned, receiptHash });

    return {
      step: i + 1,
      description: s.description,
      receipt: { ...unsigned, receiptHash, signature, approval: null },
    };
  });
}
