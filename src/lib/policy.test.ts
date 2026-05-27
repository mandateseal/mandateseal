import { describe, expect, it } from "vitest";
import { evaluatePolicy, type MandateSnapshot } from "./policy";
import type { ActionRequest } from "./schemas";

const baseSnapshot: MandateSnapshot = {
  id: "m1",
  agentId: "a1",
  name: "test-mandate",
  enabled: true,
  dailyBudgetUsd: 25,
  maxCostPerActionUsd: 2,
  approvalThresholdUsd: 5,
  allowedTools: ["paid_api_call", "web_search"],
  blockedTools: ["wallet_transfer", "shell_exec"],
  blockedActions: ["transfer_usdc"],
  approvalRequiredActions: ["send_email"],
  allowedDomains: ["api.openai.com"],
  blockedDomains: ["evil.com"],
  // v0.2 — wallet mandate. Empty defaults keep the legacy rules dominant
  // so the original 10-rule tests stay deterministic.
  agentWallet: null,
  ownerWallet: null,
  allowedChains: [],
  allowedTokens: [],
  allowedContracts: [],
  blockedContracts: [],
  blockedRecipients: [],
  maxTxValueUsd: 0,
  dailyTokenSpendUsd: 0,
  requireApprovalForSwaps: false,
  requireApprovalForTransfers: false,
};

const baseAction: ActionRequest = {
  agentId: "a1",
  actionType: "paid_api_call",
  tool: "paid_api_call",
  target: "https://api.openai.com/v1/x",
  costUsd: 0.02,
};

describe("evaluatePolicy — 10 rules in order", () => {
  it("rule 1: disabled mandate → APPROVED", () => {
    const d = evaluatePolicy(baseAction, { ...baseSnapshot, enabled: false });
    expect(d.decision).toBe("APPROVED");
    expect(d.matchedRule).toBe("mandate.enabled = false");
  });

  it("rule 2: tool in blockedTools → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...baseAction, tool: "wallet_transfer", actionType: "x" },
      baseSnapshot,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("blockedTools");
    expect(d.riskLevel).toBe("HIGH"); // wallet keyword
  });

  it("rule 3: actionType in blockedActions → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...baseAction, tool: "paid_api_call", actionType: "transfer_usdc" },
      baseSnapshot,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("blockedActions");
    expect(d.riskLevel).toBe("HIGH"); // transfer keyword
  });

  it("rule 4: target domain in blockedDomains → BLOCKED + HIGH risk", () => {
    const d = evaluatePolicy(
      { ...baseAction, target: "https://evil.com/x" },
      baseSnapshot,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("blockedDomains");
    expect(d.riskLevel).toBe("HIGH");
  });

  it("rule 5: cost > maxCostPerActionUsd → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...baseAction, costUsd: 5 },
      baseSnapshot,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("maxCostPerActionUsd");
    expect(d.riskLevel).toBe("MEDIUM");
  });

  it("rule 6: cost > approvalThresholdUsd (but ≤ max) → NEEDS_APPROVAL", () => {
    // need maxCostPerActionUsd higher than cost so rule 5 doesn't catch
    const d = evaluatePolicy(
      { ...baseAction, costUsd: 6 },
      { ...baseSnapshot, maxCostPerActionUsd: 10 },
    );
    expect(d.decision).toBe("NEEDS_APPROVAL");
    expect(d.matchedRule).toContain("approvalThresholdUsd");
  });

  it("rule 7: actionType in approvalRequiredActions → NEEDS_APPROVAL", () => {
    const d = evaluatePolicy(
      { ...baseAction, tool: "x", actionType: "send_email", costUsd: 0 },
      { ...baseSnapshot, allowedTools: [] }, // disable rule 8 for clarity
    );
    expect(d.decision).toBe("NEEDS_APPROVAL");
    expect(d.matchedRule).toContain("approvalRequiredActions");
  });

  it("rule 8: tool not in non-empty allowedTools → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...baseAction, tool: "unknown_tool", actionType: "unknown_action" },
      baseSnapshot,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("allowedTools");
  });

  it("rule 9: domain not in non-empty allowedDomains → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...baseAction, target: "https://other.com/x" },
      baseSnapshot,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("allowedDomains");
  });

  it("rule 10: default → APPROVED + LOW risk", () => {
    const d = evaluatePolicy(baseAction, baseSnapshot);
    expect(d.decision).toBe("APPROVED");
    expect(d.matchedRule).toBe("default.allow");
    expect(d.riskLevel).toBe("LOW");
  });
});

describe("evaluatePolicy — short-circuit order", () => {
  it("blockedTools fires before cost rule (rule 2 < rule 5)", () => {
    // Tool blocked AND cost over max — should hit rule 2 first
    const d = evaluatePolicy(
      { ...baseAction, tool: "wallet_transfer", actionType: "x", costUsd: 999 },
      baseSnapshot,
    );
    expect(d.matchedRule).toContain("blockedTools");
  });

  it("cost-over-max fires before approval-required (rule 5 < rule 7)", () => {
    // buy_dataset would be approval-required, but cost over max blocks first
    const d = evaluatePolicy(
      { ...baseAction, actionType: "buy_dataset", costUsd: 5 },
      { ...baseSnapshot, approvalRequiredActions: ["buy_dataset"] },
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("maxCostPerActionUsd");
  });
});

describe("evaluatePolicy — domain parsing", () => {
  it("strips protocol from URL targets", () => {
    const d = evaluatePolicy(
      { ...baseAction, target: "https://api.openai.com/anything" },
      baseSnapshot,
    );
    expect(d.decision).toBe("APPROVED");
  });

  it("handles bare hosts", () => {
    const d = evaluatePolicy(
      { ...baseAction, target: "api.openai.com" },
      baseSnapshot,
    );
    expect(d.decision).toBe("APPROVED");
  });

  it("ignores empty allowedDomains list (only allowedTools enforced)", () => {
    const d = evaluatePolicy(
      { ...baseAction, target: "anywhere.com" },
      { ...baseSnapshot, allowedDomains: [] },
    );
    // Should pass — allowedDomains empty means no domain restriction
    expect(d.decision).toBe("APPROVED");
  });
});

describe("v0.2 — crypto policy rules", () => {
  const cryptoSnap: MandateSnapshot = {
    ...baseSnapshot,
    blockedTools: [],
    blockedActions: [],
    allowedTools: [],
    allowedDomains: [],
    blockedDomains: [],
    approvalRequiredActions: [],
    maxCostPerActionUsd: 1000,
    approvalThresholdUsd: 1000,
    allowedChains: ["base", "base-sepolia"],
    allowedTokens: ["USDC", "ETH"],
    allowedContracts: ["0x" + "11".repeat(20)],
    blockedContracts: ["0x" + "ba".repeat(20)],
    blockedRecipients: ["0x" + "de".repeat(20)],
    maxTxValueUsd: 100,
    requireApprovalForSwaps: true,
    requireApprovalForTransfers: true,
  };

  const cryptoAction: ActionRequest = {
    agentId: "a1",
    actionType: "transfer_usdc",
    tool: "wallet",
    target: "0x" + "ab".repeat(20),
    costUsd: 0,
    chain: "base",
    token: "USDC",
    amount: "25000000",
    txValueUsd: 25,
    recipient: "0x" + "ab".repeat(20),
  };

  it("C1: recipient on block list → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...cryptoAction, recipient: "0x" + "de".repeat(20) },
      cryptoSnap,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("blockedRecipients");
  });

  it("C2: contract on block list → BLOCKED", () => {
    const d = evaluatePolicy(
      {
        ...cryptoAction,
        actionType: "contract_call",
        contractAddress: "0x" + "ba".repeat(20),
        functionSelector: "0xa9059cbb",
      },
      cryptoSnap,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("blockedContracts");
  });

  it("C3: chain not in allowedChains → BLOCKED", () => {
    const d = evaluatePolicy({ ...cryptoAction, chain: "solana" }, cryptoSnap);
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("allowedChains");
  });

  it("C4: token not in allowedTokens → BLOCKED", () => {
    const d = evaluatePolicy({ ...cryptoAction, token: "SHIB" }, cryptoSnap);
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("allowedTokens");
  });

  it("C5: txValueUsd over max → BLOCKED", () => {
    const d = evaluatePolicy(
      { ...cryptoAction, txValueUsd: 250 },
      cryptoSnap,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toBe("txValueUsd > maxTxValueUsd");
    expect(d.riskLevel).toBe("HIGH");
  });

  it("C6: infinite approval → BLOCKED (uint256 max)", () => {
    const d = evaluatePolicy(
      {
        ...cryptoAction,
        actionType: "token_approval",
        amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      },
      cryptoSnap,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toBe("infiniteApproval");
  });

  it("C6: infinite approval → BLOCKED (string 'max' shorthand)", () => {
    const d = evaluatePolicy(
      { ...cryptoAction, actionType: "token_approval", amount: "max" },
      cryptoSnap,
    );
    expect(d.decision).toBe("BLOCKED");
  });

  it("C6: finite approval passes the rule", () => {
    const d = evaluatePolicy(
      { ...cryptoAction, actionType: "token_approval", amount: "1000000" },
      { ...cryptoSnap, requireApprovalForTransfers: false },
    );
    expect(d.decision).not.toBe("BLOCKED");
  });

  it("C7: contract not in allowedContracts → BLOCKED", () => {
    const d = evaluatePolicy(
      {
        ...cryptoAction,
        actionType: "contract_call",
        contractAddress: "0x" + "cc".repeat(20),
        functionSelector: "0xa9059cbb",
      },
      cryptoSnap,
    );
    expect(d.decision).toBe("BLOCKED");
    expect(d.matchedRule).toContain("allowedContracts");
  });

  it("C8: token_swap → NEEDS_APPROVAL when requireApprovalForSwaps", () => {
    const d = evaluatePolicy(
      { ...cryptoAction, actionType: "token_swap" },
      cryptoSnap,
    );
    expect(d.decision).toBe("NEEDS_APPROVAL");
    expect(d.matchedRule).toBe("requireApprovalForSwaps");
  });

  it("C9: transfer_usdc → NEEDS_APPROVAL when requireApprovalForTransfers", () => {
    const d = evaluatePolicy(cryptoAction, cryptoSnap);
    expect(d.decision).toBe("NEEDS_APPROVAL");
    expect(d.matchedRule).toBe("requireApprovalForTransfers");
  });

  it("C10: contract_call with unknown selector → NEEDS_APPROVAL", () => {
    const d = evaluatePolicy(
      {
        ...cryptoAction,
        actionType: "contract_call",
        contractAddress: "0x" + "11".repeat(20),
        functionSelector: "0xdeadbeef",
      },
      { ...cryptoSnap, requireApprovalForTransfers: false },
    );
    expect(d.decision).toBe("NEEDS_APPROVAL");
    expect(d.matchedRule).toBe("unknownSelector");
  });

  it("C10: contract_call with known selector passes", () => {
    const d = evaluatePolicy(
      {
        ...cryptoAction,
        actionType: "contract_call",
        contractAddress: "0x" + "11".repeat(20),
        functionSelector: "0xa9059cbb", // transfer
      },
      { ...cryptoSnap, requireApprovalForTransfers: false },
    );
    expect(d.decision).toBe("APPROVED");
  });

  it("crypto rules skipped when fields absent (legacy actions still work)", () => {
    const d = evaluatePolicy(
      {
        agentId: "a1",
        actionType: "search",
        tool: "web_search",
        target: "github.com",
        costUsd: 0.01,
      },
      { ...cryptoSnap, allowedDomains: ["github.com"] },
    );
    expect(d.decision).toBe("APPROVED");
  });
});
