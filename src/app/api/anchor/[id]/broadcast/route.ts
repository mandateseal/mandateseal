import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicBatch } from "@/lib/anchor";
import { broadcastAnchor, isAnchorConfigured } from "@/lib/onchain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/anchor/:id/broadcast
// Retry broadcasting a batch that was sealed but never (or unsuccessfully)
// pushed onchain. No-op if the batch already has a txHash.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isAnchorConfigured()) {
    return NextResponse.json({ error: "Onchain anchor not configured" }, { status: 400 });
  }
  const existing = await prisma.anchorBatch.findUnique({ where: { id: params.id } });
  if (!existing) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (existing.txHash) {
    return NextResponse.json(
      { batch: publicBatch(existing), alreadyBroadcast: true },
    );
  }

  try {
    const tx = await broadcastAnchor({
      batchIndex: existing.batchIndex,
      prevRoot: existing.prevRoot,
      root: existing.root,
    });
    const updated = await prisma.anchorBatch.update({
      where: { id: existing.id },
      data: { chain: tx.chain, txHash: tx.txHash, blockNumber: tx.blockNumber },
    });
    return NextResponse.json({ batch: publicBatch(updated) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Broadcast failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
