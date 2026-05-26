import type { NextRequest } from "next/server";
import { prisma } from "./db";
import { hashApiKey } from "./crypto";

export interface AuthedAgent {
  id: string;
  name: string;
  role: string;
  status: string;
}

export function extractBearer(req: NextRequest | Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!h) return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function authenticateAgent(req: NextRequest | Request): Promise<AuthedAgent | null> {
  const key = extractBearer(req);
  if (!key) return null;
  const agent = await prisma.agent.findUnique({
    where: { apiKeyHash: hashApiKey(key) },
    select: { id: true, name: true, role: true, status: true },
  });
  if (!agent) return null;
  if (agent.status !== "active") return null;
  return agent;
}
