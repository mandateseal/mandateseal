import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicBatch, sealNextBatch } from "@/lib/anchor";

export const runtime = "nodejs";

// GET /api/anchor — list batches newest first
export async function GET() {
  const batches = await prisma.anchorBatch.findMany({ orderBy: { batchIndex: "desc" }, take: 100 });
  const pending = await prisma.receipt.count({ where: { anchorBatchId: null } });
  return NextResponse.json({ batches: batches.map(publicBatch), pendingReceipts: pending });
}

// POST /api/anchor — seal the next batch (all unanchored receipts)
export async function POST() {
  const result = await sealNextBatch();
  if (!result) {
    return NextResponse.json({ error: "No receipts to anchor" }, { status: 400 });
  }
  return NextResponse.json({ batch: publicBatch(result.batch), leafCount: result.leafCount }, { status: 201 });
}
