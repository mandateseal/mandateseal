import { NextResponse } from "next/server";
import { actionRequestSchema } from "@/lib/schemas";
import { authenticateAgent } from "@/lib/auth";
import { evaluateAndSeal, IdempotencyConflictError } from "@/lib/receipt";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";
import { hashRequestPayload, readIdempotencyKey } from "@/lib/idempotency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    // Limit pre-auth attempts by IP so brute-forcing keys is expensive.
    const ipLimit = checkRateLimit(`check:ip:${clientIp(req)}`, { limit: 30, windowMs: 60_000 });
    if (!ipLimit.allowed) {
      const r = rateLimitResponse(ipLimit);
      return NextResponse.json(r.body, r.init);
    }
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  // Post-auth: limit per-agent so one key abuse can't drain the DB.
  const agentLimit = checkRateLimit(`check:agent:${agent.id}`, { limit: 120, windowMs: 60_000 });
  if (!agentLimit.allowed) {
    const r = rateLimitResponse(agentLimit);
    return NextResponse.json(r.body, r.init);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = actionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action request", issues: parsed.error.issues }, { status: 400 });
  }

  if (parsed.data.agentId !== agent.id) {
    return NextResponse.json(
      { error: "agentId in payload does not match authenticated agent" },
      { status: 403 },
    );
  }

  const idempotencyKey = readIdempotencyKey(req);
  const requestHash = idempotencyKey
    ? hashRequestPayload({ agentId: agent.id, action: parsed.data })
    : null;

  try {
    const receipt = await evaluateAndSeal(parsed.data, { idempotencyKey, requestHash });
    return NextResponse.json({
      decision: receipt.decision,
      reason: receipt.reason,
      matchedRule: receipt.matchedRule,
      riskLevel: receipt.riskLevel,
      receipt,
    });
  } catch (err) {
    if (err instanceof IdempotencyConflictError) {
      return NextResponse.json(
        { error: err.message, code: "IDEMPOTENCY_CONFLICT" },
        { status: 409 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
