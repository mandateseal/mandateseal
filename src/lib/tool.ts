import type { Tool } from "@prisma/client";
import { z } from "zod";

export const toolKindEnum = z.enum(["http"]);
export const httpMethodEnum = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const createToolSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z][a-z0-9_-]*$/, "lowercase letters / digits / _ / -"),
  description: z.string().max(500).optional().default(""),
  kind: toolKindEnum.optional().default("http"),
  endpoint: z.string().url(),
  method: httpMethodEnum.optional().default("POST"),
  defaultCostUsd: z.number().nonnegative().optional().default(0),
  enabled: z.boolean().optional().default(true),
});

export const updateToolSchema = createToolSchema.partial();

export interface ToolView {
  id: string;
  name: string;
  description: string;
  kind: string;
  endpoint: string;
  method: string;
  defaultCostUsd: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function publicTool(t: Tool): ToolView {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    kind: t.kind,
    endpoint: t.endpoint,
    method: t.method,
    defaultCostUsd: t.defaultCostUsd,
    enabled: t.enabled,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
