import { NextResponse } from "next/server";
import { z } from "zod";
import { decideApproval, toApprovalView } from "@/lib/approval";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    decidedBy: z.string().min(1).max(80).optional(),
    decisionNote: z.string().max(500).optional(),
  })
  .partial();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty body */
  }
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const result = await decideApproval({
    id: params.id,
    status: "denied",
    decidedBy: parsed.data.decidedBy ?? "admin",
    decisionNote: parsed.data.decisionNote ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ approval: toApprovalView(result.approval) });
}
