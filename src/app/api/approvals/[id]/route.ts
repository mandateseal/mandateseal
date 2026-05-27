import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expireIfDue, toApprovalView } from "@/lib/approval";
import { publicReceipt } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const found = await prisma.approval.findUnique({
    where: { id: params.id },
    include: { receipt: true },
  });
  if (!found) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  const fresh = await expireIfDue(found);
  return NextResponse.json({
    approval: toApprovalView(fresh),
    receipt: publicReceipt(found.receipt),
  });
}
