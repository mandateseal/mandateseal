import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireIfDue, toApprovalView } from "@/lib/approval";

export const runtime = "nodejs";

// GET /api/approvals/:id/wait?timeoutMs=25000
// Long-poll: blocks until the approval is no longer pending OR until timeout.
// Default timeout 25s — keeps comfortably under most reverse-proxy idle windows.
// SDK should retry on `status: "pending"` if it gets one back due to timeout.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const url = new URL(req.url);
  const timeoutMs = Math.min(Math.max(Number(url.searchParams.get("timeoutMs") ?? "25000") || 25000, 1000), 60_000);
  const pollMs = 500;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    const a = await prisma.approval.findUnique({ where: { id: params.id } });
    if (!a) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    const after = await expireIfDue(a);
    if (after.status !== "pending") {
      return NextResponse.json({ approval: toApprovalView(after) });
    }
    if (Date.now() >= deadline) {
      return NextResponse.json({ approval: toApprovalView(after), timedOut: true });
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
