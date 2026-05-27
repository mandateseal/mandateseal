import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireAllOverdue, toApprovalListItem } from "@/lib/approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/approvals?status=pending&agentId=...&limit=N
export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "100") || 100, 500);

  await expireAllOverdue();

  const approvals = await prisma.approval.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(agentId ? { agentId } : {}),
    },
    orderBy: { requestedAt: "desc" },
    take: limit,
    include: { receipt: true },
  });

  return NextResponse.json({ approvals: approvals.map(toApprovalListItem) });
}
