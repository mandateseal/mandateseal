import { NextResponse } from "next/server";
import { actionRequestSchema } from "@/lib/schemas";
import { authenticateAgent } from "@/lib/auth";
import { evaluateAndSeal } from "@/lib/receipt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const agent = await authenticateAgent(req);
  if (!agent) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
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

  try {
    const receipt = await evaluateAndSeal(parsed.data);
    return NextResponse.json({
      decision: receipt.decision,
      reason: receipt.reason,
      matchedRule: receipt.matchedRule,
      riskLevel: receipt.riskLevel,
      receipt,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
