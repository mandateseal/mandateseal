import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicBatch, sealNextBatch } from "@/lib/anchor";
import { broadcastAnchor, isAnchorConfigured } from "@/lib/onchain";
import { checkRateLimit, clientIp, rateLimitResponse } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/anchor — list batches newest first
export async function GET() {
  const batches = await prisma.anchorBatch.findMany({ orderBy: { batchIndex: "desc" }, take: 100 });
  const pending = await prisma.receipt.count({ where: { anchorBatchId: null } });
  return NextResponse.json({
    batches: batches.map(publicBatch),
    pendingReceipts: pending,
    onchain: { configured: isAnchorConfigured() },
  });
}

// POST /api/anchor — seal the next batch (all unanchored receipts).
// If onchain anchoring is configured, broadcasts the root to chain and
// records txHash/blockNumber. Broadcast failure does NOT roll back the seal —
// the batch stays in the DB with txHash=null and can be retried via
// POST /api/anchor/:id/broadcast.
//
// Heavy endpoint — sealing is a tx-write + onchain broadcast. Cap aggressively.
export async function POST(req: Request) {
  const lim = checkRateLimit(`anchor:ip:${clientIp(req)}`, { limit: 5, windowMs: 60_000 });
  if (!lim.allowed) {
    const r = rateLimitResponse(lim);
    return NextResponse.json(r.body, r.init);
  }
  const result = await sealNextBatch();
  if (!result) {
    return NextResponse.json({ error: "No receipts to anchor" }, { status: 400 });
  }

  let broadcastError: string | null = null;
  let batch = result.batch;
  if (isAnchorConfigured()) {
    try {
      const tx = await broadcastAnchor({
        batchIndex: batch.batchIndex,
        prevRoot: batch.prevRoot,
        root: batch.root,
      });
      batch = await prisma.anchorBatch.update({
        where: { id: batch.id },
        data: { chain: tx.chain, txHash: tx.txHash, blockNumber: tx.blockNumber },
      });
    } catch (err) {
      broadcastError = err instanceof Error ? err.message : "Broadcast failed";
    }
  }

  return NextResponse.json(
    {
      batch: publicBatch(batch),
      leafCount: result.leafCount,
      broadcastError,
    },
    { status: 201 },
  );
}
