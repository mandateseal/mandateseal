import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyRequestSchema } from "@/lib/schemas";
import { recomputeAndVerify, reEvaluateFromSnapshot } from "@/lib/receipt";
import { publicReceipt } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Two supported shapes:
  //   { id: "rct_..." }            -> look up stored receipt and recompute
  //   { ...full receipt object }   -> verify against caller-supplied payload
  if (typeof body === "object" && body !== null && "id" in body && Object.keys(body).length === 1) {
    const id = String((body as Record<string, unknown>).id);
    const stored = await prisma.receipt.findUnique({ where: { id } });
    if (!stored) {
      return NextResponse.json({ valid: false, reasons: ["Receipt not found"] }, { status: 404 });
    }
    const r = publicReceipt(stored);
    const verdict = recomputeAndVerify({ ...r, rawPayload: r.rawPayload ?? {} });
    const reEval = reEvaluateFromSnapshot({ ...r, rawPayload: r.rawPayload ?? {} });
    return NextResponse.json({
      valid: verdict.valid,
      reasons: verdict.reasons,
      reEvaluation: { matched: reEval.matched, expected: reEval.expected },
      receipt: r,
    });
  }

  const parsed = verifyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid receipt payload", issues: parsed.error.issues }, { status: 400 });
  }

  const verdict = recomputeAndVerify({ ...parsed.data, rawPayload: parsed.data.rawPayload ?? {} });
  const reEval = reEvaluateFromSnapshot({ ...parsed.data, rawPayload: parsed.data.rawPayload ?? {} });
  return NextResponse.json({
    valid: verdict.valid,
    reasons: verdict.reasons,
    reEvaluation: { matched: reEval.matched, expected: reEval.expected },
  });
}
