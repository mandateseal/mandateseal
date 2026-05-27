import { z } from "zod";

const isoOrTimestamp = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "must be ISO 8601 or parseable date")
  .transform((s) => new Date(s));

export const receiptFilterSchema = z.object({
  agentId: z.string().min(1).optional(),
  mandateId: z.string().min(1).optional(),
  decision: z.enum(["APPROVED", "BLOCKED", "NEEDS_APPROVAL"]).optional(),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  tool: z.string().min(1).optional(),
  actionType: z.string().min(1).optional(),
  from: isoOrTimestamp.optional(),
  to: isoOrTimestamp.optional(),
  costMin: z.coerce.number().nonnegative().optional(),
  costMax: z.coerce.number().nonnegative().optional(),
  q: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type ReceiptFilter = z.infer<typeof receiptFilterSchema>;

export function parseReceiptFilter(searchParams: URLSearchParams): {
  ok: true;
  filter: ReceiptFilter;
} | {
  ok: false;
  error: string;
} {
  const raw: Record<string, string> = {};
  for (const [k, v] of searchParams.entries()) {
    if (v !== "" && v !== "any" && v !== "all") raw[k] = v;
  }
  const parsed = receiptFilterSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ") };
  }
  return { ok: true, filter: parsed.data };
}

/** Build the Prisma `where` clause for a filter. */
export function toPrismaWhere(f: ReceiptFilter) {
  const where: Record<string, unknown> = {};
  if (f.agentId) where.agentId = f.agentId;
  if (f.mandateId) where.mandateId = f.mandateId;
  if (f.decision) where.decision = f.decision;
  if (f.riskLevel) where.riskLevel = f.riskLevel;
  if (f.tool) where.tool = f.tool;
  if (f.actionType) where.actionType = f.actionType;
  if (f.from || f.to) {
    where.timestamp = {
      ...(f.from ? { gte: f.from } : {}),
      ...(f.to ? { lte: f.to } : {}),
    };
  }
  if (f.costMin !== undefined || f.costMax !== undefined) {
    where.costUsd = {
      ...(f.costMin !== undefined ? { gte: f.costMin } : {}),
      ...(f.costMax !== undefined ? { lte: f.costMax } : {}),
    };
  }
  if (f.q) {
    const needle = f.q;
    where.OR = [
      { reason: { contains: needle } },
      { matchedRule: { contains: needle } },
      { target: { contains: needle } },
      { actionType: { contains: needle } },
      { tool: { contains: needle } },
    ];
  }
  return where;
}
