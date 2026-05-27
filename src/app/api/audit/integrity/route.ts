import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recomputeAndVerify } from "@/lib/receipt";
import { publicReceipt } from "@/lib/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IntegrityFailure {
  id: string;
  agentId: string;
  timestamp: string;
  reasons: string[];
}

// GET /api/audit/integrity?agentId=…&limit=…
//
// Walks every receipt matching the filter and recomputes its canonical hash +
// Ed25519 signature. Returns a roll-up plus the first N failures for triage.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "10000") || 10000, 50_000);

  const startedAt = Date.now();
  const receipts = await prisma.receipt.findMany({
    where: agentId ? { agentId } : undefined,
    orderBy: { timestamp: "asc" },
    take: limit,
  });

  let valid = 0;
  let invalid = 0;
  const failures: IntegrityFailure[] = [];
  const MAX_REPORTED_FAILURES = 25;

  for (const r of receipts) {
    const view = publicReceipt(r);
    const verdict = recomputeAndVerify({ ...view, rawPayload: view.rawPayload ?? {} });
    if (verdict.valid) {
      valid++;
    } else {
      invalid++;
      if (failures.length < MAX_REPORTED_FAILURES) {
        failures.push({
          id: r.id,
          agentId: r.agentId,
          timestamp: r.timestamp.toISOString(),
          reasons: verdict.reasons,
        });
      }
    }
  }

  return NextResponse.json({
    scanned: receipts.length,
    valid,
    invalid,
    integrity: receipts.length === 0 ? 1 : valid / receipts.length,
    durationMs: Date.now() - startedAt,
    truncated: receipts.length === limit,
    failures,
  });
}
