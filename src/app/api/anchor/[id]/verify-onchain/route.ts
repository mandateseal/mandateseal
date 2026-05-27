import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAnchor, isAnchorConfigured, explorerTxUrl } from "@/lib/onchain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/anchor/:id/verify-onchain
// Fetches the broadcast tx from chain, decodes its calldata, and compares
// (batchIndex, prevRoot, root) against the DB row. Public — no auth — so
// any third party can confirm the anchor came from us and matches.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isAnchorConfigured()) {
    return NextResponse.json({ error: "Onchain anchor not configured on this server" }, { status: 400 });
  }
  const batch = await prisma.anchorBatch.findUnique({ where: { id: params.id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (!batch.txHash || !batch.chain) {
    return NextResponse.json({ error: "Batch has not been broadcast onchain" }, { status: 400 });
  }

  const onchain = await fetchAnchor(batch.txHash);
  if (!onchain) {
    return NextResponse.json(
      { ok: false, reason: "Tx not found or calldata doesn't match MS01 anchor format" },
      { status: 200 },
    );
  }

  const mismatches: string[] = [];
  if (onchain.batchIndex !== batch.batchIndex) {
    mismatches.push(`batchIndex: chain=${onchain.batchIndex} db=${batch.batchIndex}`);
  }
  if (onchain.prevRoot !== batch.prevRoot.toLowerCase()) {
    mismatches.push(`prevRoot mismatch`);
  }
  if (onchain.root !== batch.root.toLowerCase()) {
    mismatches.push(`root mismatch`);
  }
  if (onchain.chain !== batch.chain) {
    mismatches.push(`chain: tx-on=${onchain.chain} db=${batch.chain}`);
  }

  return NextResponse.json({
    ok: mismatches.length === 0,
    mismatches,
    onchain: {
      chain: onchain.chain,
      txHash: batch.txHash,
      blockNumber: onchain.blockNumber,
      from: onchain.from,
      batchIndex: onchain.batchIndex,
      prevRoot: onchain.prevRoot,
      root: onchain.root,
      explorerUrl: explorerTxUrl(onchain.chain, batch.txHash),
    },
  });
}
