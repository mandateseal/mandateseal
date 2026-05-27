import type { AnchorBatch, Receipt } from "@prisma/client";
import { prisma } from "./db";
import { randomId } from "./crypto";
import { buildRoot, buildProof, verifyProof, leafHash } from "./merkle";

export const GENESIS_PREV_ROOT = "0".repeat(64);

export interface AnchorBatchView {
  id: string;
  batchIndex: number;
  root: string;
  prevRoot: string;
  receiptCount: number;
  startedAt: string;
  endedAt: string;
  chain: string | null;
  txHash: string | null;
  blockNumber: number | null;
  createdAt: string;
}

export function publicBatch(b: AnchorBatch): AnchorBatchView {
  return {
    id: b.id,
    batchIndex: b.batchIndex,
    root: b.root,
    prevRoot: b.prevRoot,
    receiptCount: b.receiptCount,
    startedAt: b.startedAt.toISOString(),
    endedAt: b.endedAt.toISOString(),
    chain: b.chain,
    txHash: b.txHash,
    blockNumber: b.blockNumber,
    createdAt: b.createdAt.toISOString(),
  };
}

/**
 * Seal the next batch: gather every receipt without an anchor, build a merkle
 * tree of their `receiptHash`es, persist the batch, link receipts to it.
 *
 * Returns null when there's nothing to anchor.
 *
 * Hash chain: each batch's `prevRoot` is the previous batch's `root`. Tampering
 * with any historical batch breaks every subsequent root — that's the chain
 * property we want before going onchain.
 */
export async function sealNextBatch(): Promise<{
  batch: AnchorBatch;
  leafCount: number;
} | null> {
  // Order by createdAt to keep merkle leaves stable and reproducible.
  const pending = await prisma.receipt.findMany({
    where: { anchorBatchId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, receiptHash: true, createdAt: true },
  });
  if (pending.length === 0) return null;

  const leaves = pending.map((r) => r.receiptHash);
  const root = buildRoot(leaves);

  const lastBatch = await prisma.anchorBatch.findFirst({ orderBy: { batchIndex: "desc" } });
  const batchIndex = (lastBatch?.batchIndex ?? 0) + 1;
  const prevRoot = lastBatch?.root ?? GENESIS_PREV_ROOT;

  const startedAt = pending[0].createdAt;
  const endedAt = pending[pending.length - 1].createdAt;

  // Persist batch + atomically link receipts.
  const batch = await prisma.$transaction(async (tx) => {
    const created = await tx.anchorBatch.create({
      data: {
        id: randomId("anc"),
        batchIndex,
        root,
        prevRoot,
        receiptCount: pending.length,
        startedAt,
        endedAt,
      },
    });
    await tx.receipt.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { anchorBatchId: created.id },
    });
    return created;
  });

  return { batch, leafCount: pending.length };
}

export interface AnchorProofResult {
  receiptId: string;
  receiptHash: string;
  batchIndex: number;
  batchId: string;
  root: string;
  prevRoot: string;
  proof: string[];
  leafIndex: number;
}

/**
 * Construct a fresh merkle proof for one receipt by rebuilding its anchor
 * batch's leaf set on demand. Cheaper than persisting the proof per receipt.
 */
export async function buildAnchorProof(receiptId: string): Promise<AnchorProofResult | null> {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { anchor: true },
  });
  if (!receipt || !receipt.anchor) return null;

  const leaves = await prisma.receipt.findMany({
    where: { anchorBatchId: receipt.anchor.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, receiptHash: true },
  });
  const idx = leaves.findIndex((l) => l.id === receiptId);
  if (idx < 0) return null;

  const proof = buildProof(leaves.map((l) => l.receiptHash), idx);

  return {
    receiptId: receipt.id,
    receiptHash: receipt.receiptHash,
    batchIndex: receipt.anchor.batchIndex,
    batchId: receipt.anchor.id,
    root: receipt.anchor.root,
    prevRoot: receipt.anchor.prevRoot,
    proof,
    leafIndex: idx,
  };
}

/** Standalone verification — given a proof + claimed root, no DB lookup. */
export function verifyAnchorProof(args: {
  receiptHash: string;
  proof: string[];
  root: string;
}): boolean {
  return verifyProof(args.receiptHash, args.proof, args.root);
}

/**
 * Walk the entire chain and confirm:
 *   1. Every batch's root recomputes from its leaves.
 *   2. Every batch's prevRoot equals the previous batch's root.
 *
 * Returns roll-up + the first N failures.
 */
export async function auditAnchorChain(): Promise<{
  scanned: number;
  valid: number;
  invalid: number;
  failures: Array<{ batchIndex: number; reasons: string[] }>;
}> {
  const batches = await prisma.anchorBatch.findMany({ orderBy: { batchIndex: "asc" } });
  const failures: Array<{ batchIndex: number; reasons: string[] }> = [];
  let valid = 0;
  let expectedPrev = GENESIS_PREV_ROOT;

  for (const b of batches) {
    const leaves = await prisma.receipt.findMany({
      where: { anchorBatchId: b.id },
      orderBy: { createdAt: "asc" },
      select: { receiptHash: true },
    });
    const reasons: string[] = [];
    const recomputed = buildRoot(leaves.map((l) => l.receiptHash));
    if (recomputed !== b.root) {
      reasons.push(`root mismatch: stored ${b.root.slice(0, 12)}… recomputed ${recomputed.slice(0, 12)}…`);
    }
    if (b.prevRoot !== expectedPrev) {
      reasons.push(`prevRoot break: expected ${expectedPrev.slice(0, 12)}… stored ${b.prevRoot.slice(0, 12)}…`);
    }
    if (leaves.length !== b.receiptCount) {
      reasons.push(`leaf count mismatch: stored ${b.receiptCount}, found ${leaves.length}`);
    }
    if (reasons.length === 0) valid++;
    else failures.push({ batchIndex: b.batchIndex, reasons });
    expectedPrev = b.root;
  }

  return {
    scanned: batches.length,
    valid,
    invalid: batches.length - valid,
    failures: failures.slice(0, 25),
  };
}

export { leafHash };
