import { z } from "zod";

export const decisionEnum = z.enum(["APPROVED", "BLOCKED", "NEEDS_APPROVAL"]);
export const riskEnum = z.enum(["LOW", "MEDIUM", "HIGH"]);

export const createAgentSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.string().min(1).max(120),
});

export const stringArray = z.array(z.string().min(1)).default([]);

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
});

export const verifyRequestSchema = receiptSchema;
