import { z } from "zod";

export const decisionEnum = z.enum(["APPROVED", "BLOCKED", "NEEDS_APPROVAL"]);
export const riskEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createAgentSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(120),
});

export const stringArray = z.array(z.string().min(1)).default([]);

// 0x-prefixed 40-hex-char EVM address. Lowercase canonicalization is left to
// the caller; matching in the policy engine is case-insensitive.
export const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "expected 0x-prefixed EVM address");

export const createMandateSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  dailyBudgetUsd: z.number().nonnegative().default(0),
  maxCostPerActionUsd: z.number().nonnegative().default(0),
  approvalThresholdUsd: z.number().nonnegative().default(0),
  allowedTools: stringArray,
  blockedTools: stringArray,
  blockedActions: stringArray,
  approvalRequiredActions: stringArray,
  allowedDomains: stringArray,
  blockedDomains: stringArray,
  // v0.2 — wallet mandate fields. All optional; legacy mandates work unchanged.
  agentWallet: evmAddress.optional().nullable(),
  ownerWallet: evmAddress.optional().nullable(),
  allowedChains: stringArray,
  allowedTokens: stringArray,
  allowedContracts: stringArray,
  blockedContracts: stringArray,
  blockedRecipients: stringArray,
  maxTxValueUsd: z.number().nonnegative().default(0),
  dailyTokenSpendUsd: z.number().nonnegative().default(0),
  requireApprovalForSwaps: z.boolean().default(false),
  requireApprovalForTransfers: z.boolean().default(false),
  // v0.4 — per-mandate public exposure policy on /r/:id. Null = built-in
  // safe defaults; explicit array = allowlist of field names.
  publicFields: z.array(z.string().min(1)).optional().nullable(),
});

export const updateMandateSchema = createMandateSchema.partial().omit({ agentId: true });

export const actionRequestSchema = z.object({
  agentId: z.string().min(1),
  mandateId: z.string().min(1).optional(),
  actionType: z.string().min(1),
  tool: z.string().min(1),
  target: z.string().min(1),
  costUsd: z.number().nonnegative().default(0),
  metadata: z.record(z.unknown()).optional(),
  // v0.2 — optional crypto fields. Policy engine activates crypto-specific
  // rules only when these are present; non-crypto actions are unchanged.
  chain: z.string().min(1).max(40).optional(),
  wallet: evmAddress.optional(),
  token: z.string().min(1).max(40).optional(),
  amount: z.string().min(1).max(80).optional(),
  txValueUsd: z.number().nonnegative().optional(),
  recipient: z.string().min(1).max(80).optional(),
  contractAddress: evmAddress.optional(),
  functionSelector: z.string().regex(/^0x[0-9a-fA-F]{8}$/).optional(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

export type ActionRequest = z.infer<typeof actionRequestSchema>;

export const receiptSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  mandateId: z.string(),
  actionType: z.string(),
  tool: z.string(),
  target: z.string(),
  costUsd: z.number(),
  decision: decisionEnum,
  reason: z.string(),
  matchedRule: z.string(),
  riskLevel: riskEnum,
  timestamp: z.string(),
  policyHash: z.string(),
  receiptHash: z.string(),
  signature: z.string(),
  rawPayload: z.record(z.unknown()).optional(),
  // v0.2 — optional crypto fields. Present only when the source action was
  // a crypto action; never modify receipt verification logic (those fields
  // live inside rawPayload too so the hash already covers them).
  chain: z.string().optional().nullable(),
  wallet: z.string().optional().nullable(),
  token: z.string().optional().nullable(),
  amount: z.string().optional().nullable(),
  txValueUsd: z.number().optional().nullable(),
  recipient: z.string().optional().nullable(),
  contractAddress: z.string().optional().nullable(),
  functionSelector: z.string().optional().nullable(),
  txHash: z.string().optional().nullable(),
});

export const verifyRequestSchema = receiptSchema;
