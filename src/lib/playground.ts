// MandateSeal playground — scripted demo agent.
//
// Eight hand-tuned actions that an autonomous crypto agent might attempt.
// Each runs through the *real* policy engine + receipt sealer (Ed25519
// signature, canonical hash) but is NOT persisted to the database. The point
// is to show a visitor what MandateSeal does end-to-end in one page — without
// polluting the DB or burning rate limits on every page view.

import { hashCanonical, signReceipt, randomId } from "./crypto";
import { evaluatePolicy, type MandateSnapshot } from "./policy";
import type { ActionRequest } from "./schemas";
import { DEFAULT_AGENT } from "./constants";
import type { ReceiptRecord } from "./receipt";

const DEMO_RECIPIENT_BLOCKED = "0x" + "de".repeat(20);
const DEMO_RECIPIENT_OK = "0x" + "ab".repeat(20);
const DEMO_DEX = "0x" + "11".repeat(20);
const DEMO_UNKNOWN_CONTRACT = "0x" + "22".repeat(20);
const DEMO_GOVERNOR = "0x" + "33".repeat(20);
const DEMO_OWNER = "0x" + "fb".repeat(20);
const DEMO_AGENT_WALLET = "0x" + "a4".repeat(20);

// v0.2 — wallet-aware demo mandate. Drives the crypto rules in the policy
// engine end-to-end so the visitor can see every crypto rule fire at least
// once across the script.
function demoSnapshot(): MandateSnapshot {
  return {
    id: "mandate_research_budget_v1",
    agentId: DEFAULT_AGENT.id,
    name: "research-budget-v1",
    enabled: true,
    dailyBudgetUsd: 25,
    maxCostPerActionUsd: 2,
    approvalThresholdUsd: 5,
    allowedTools: [],
    blockedTools: ["shell_exec"],
    blockedActions: [],
    approvalRequiredActions: [],
    allowedDomains: [],
    blockedDomains: [],
    agentWallet: DEMO_AGENT_WALLET,
    ownerWallet: DEMO_OWNER,
    allowedChains: ["base", "base-sepolia"],
    allowedTokens: ["USDC", "ETH"],
    allowedContracts: [DEMO_DEX, DEMO_GOVERNOR],
    blockedContracts: [],
    blockedRecipients: [DEMO_RECIPIENT_BLOCKED],
    allowedRecipients: [],
    maxTxValueUsd: 200,
    dailyTokenSpendUsd: 500,
    requireApprovalForSwaps: true,
    requireApprovalForTransfers: false,
    publicFields: null,
  };
}

export interface ScriptedAction {
  description: string;
  action: Omit<ActionRequest, "agentId">;
}

export const SCRIPT: ScriptedAction[] = [
  {
    description: "transfer 25 USDC on Base to a trusted recipient",
    action: {
      actionType: "transfer_usdc",
      tool: "wallet",
      target: DEMO_RECIPIENT_OK,
      costUsd: 0,
      chain: "base",
      token: "USDC",
      amount: "25000000",
      txValueUsd: 25,
      recipient: DEMO_RECIPIENT_OK,
    },
  },
  {
    description: "swap 0.001 ETH → USDC on Base",
    action: {
      actionType: "token_swap",
      tool: "dex",
      target: DEMO_DEX,
      costUsd: 0,
      chain: "base",
      token: "ETH",
      amount: "1000000000000000",
      txValueUsd: 3.5,
      contractAddress: DEMO_DEX,
      functionSelector: "0x38ed1739",
    },
  },
  {
    description: "DAO vote on a Base governor proposal",
    action: {
      actionType: "dao_vote",
      tool: "governor",
      target: DEMO_GOVERNOR,
      costUsd: 0,
      chain: "base",
      contractAddress: DEMO_GOVERNOR,
      functionSelector: "0xa9059cbb",
    },
  },
  {
    description: "approve $1 USDC spend to the DEX (finite)",
    action: {
      actionType: "token_approval",
      tool: "wallet",
      target: DEMO_DEX,
      costUsd: 0,
      chain: "base",
      token: "USDC",
      amount: "1000000",
      contractAddress: DEMO_DEX,
      functionSelector: "0x095ea7b3",
    },
  },
  {
    description: "approve INFINITE USDC spend to the DEX",
    action: {
      actionType: "token_approval",
      tool: "wallet",
      target: DEMO_DEX,
      costUsd: 0,
      chain: "base",
      token: "USDC",
      amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      contractAddress: DEMO_DEX,
      functionSelector: "0x095ea7b3",
    },
  },
  {
    description: "call an unknown contract method on Base",
    action: {
      actionType: "contract_call",
      tool: "wallet",
      target: DEMO_UNKNOWN_CONTRACT,
      costUsd: 0,
      chain: "base",
      contractAddress: DEMO_UNKNOWN_CONTRACT,
      functionSelector: "0xdeadbeef",
    },
  },
  {
    description: "transfer 250 USDC to a blocked recipient",
    action: {
      actionType: "transfer_usdc",
      tool: "wallet",
      target: DEMO_RECIPIENT_BLOCKED,
      costUsd: 0,
      chain: "base",
      token: "USDC",
      amount: "250000000",
      txValueUsd: 250,
      recipient: DEMO_RECIPIENT_BLOCKED,
    },
  },
  {
    description: "bridge 100 USDC Base → Solana (chain not allowed)",
    action: {
      actionType: "bridge_transfer",
      tool: "bridge",
      target: "solana",
      costUsd: 0,
      chain: "solana",
      token: "USDC",
      amount: "100000000",
      txValueUsd: 100,
    },
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
    const timestamp = new Date(baseTime + i * 1500).toISOString();

    const cryptoFields: Record<string, unknown> = {};
    if (action.chain !== undefined) cryptoFields.chain = action.chain;
    if (action.token !== undefined) cryptoFields.token = action.token;
    if (action.amount !== undefined) cryptoFields.amount = action.amount;
    if (action.txValueUsd !== undefined) cryptoFields.txValueUsd = action.txValueUsd;
    if (action.recipient !== undefined) cryptoFields.recipient = action.recipient;
    if (action.contractAddress !== undefined) cryptoFields.contractAddress = action.contractAddress;
    if (action.functionSelector !== undefined) cryptoFields.functionSelector = action.functionSelector;

    const rawPayload: Record<string, unknown> = {
      actionType: action.actionType,
      tool: action.tool,
      target: action.target,
      costUsd: action.costUsd,
      metadata: action.metadata ?? null,
      mandateSnapshot: snapshot,
      ...(Object.keys(cryptoFields).length > 0 ? { crypto: cryptoFields } : {}),
    };

    const policyHash = hashCanonical({
      mandate: snapshot,
      action: {
        actionType: action.actionType,
        tool: action.tool,
        target: action.target,
        costUsd: action.costUsd,
        metadata: action.metadata ?? null,
        ...(Object.keys(cryptoFields).length > 0 ? { crypto: cryptoFields } : {}),
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
      receipt: {
        ...unsigned,
        receiptHash,
        signature,
        approval: null,
        chain: action.chain ?? null,
        wallet: action.wallet ?? null,
        token: action.token ?? null,
        amount: action.amount ?? null,
        txValueUsd: action.txValueUsd ?? null,
        recipient: action.recipient ?? null,
        contractAddress: action.contractAddress ?? null,
        functionSelector: action.functionSelector ?? null,
        txHash: null,
      },
    };
  });
}
