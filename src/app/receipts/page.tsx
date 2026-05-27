import Link from "next/link";
import { prisma } from "@/lib/db";
import { publicReceipt } from "@/lib/serialize";
import { ReceiptTable } from "@/components/ReceiptTable";
import { ReceiptsFilterBar } from "@/components/ReceiptsFilterBar";
import { Pagination } from "@/components/Pagination";
import { StatTile } from "@/components/StatTile";
import { parseReceiptFilter, toPrismaWhere } from "@/lib/receipt-filter";
import { SectionSubNav, LOGS_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const FILTER_KEYS = [
  "q",
  "decision",
  "riskLevel",
  "tool",
  "actionType",
  "agentId",
  "from",
  "to",
  "costMin",
  "costMax",
] as const;

function searchParamsToObject(sp: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) out[k] = v;
    else if (Array.isArray(v) && typeof v[0] === "string" && v[0]) out[k] = v[0];
  }
  return out;
}

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flat = searchParamsToObject(searchParams);
  const params = new URLSearchParams(flat);

  const parsed = parseReceiptFilter(params);
  const filter = parsed.ok ? parsed.filter : {};
  const where = toPrismaWhere(filter);
  const limit = filter.limit ?? DEFAULT_LIMIT;
  const offset = filter.offset ?? 0;

  const [receipts, total, totalAll, distinctTools, distinctActions, agents, decisionCounts] = await Promise.all([
    prisma.receipt.findMany({ where, orderBy: { timestamp: "desc" }, take: limit, skip: offset }),
    prisma.receipt.count({ where }),
    prisma.receipt.count(),
    prisma.receipt.findMany({ select: { tool: true }, distinct: ["tool"], orderBy: { tool: "asc" } }),
    prisma.receipt.findMany({ select: { actionType: true }, distinct: ["actionType"], orderBy: { actionType: "asc" } }),
    prisma.agent.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    prisma.receipt.groupBy({ by: ["decision"], where, _count: { _all: true } }),
  ]);

  // Derive UI filter state directly from the URL — single source of truth.
  const initial = Object.fromEntries(FILTER_KEYS.map((k) => [k, flat[k]])) as Record<
    (typeof FILTER_KEYS)[number],
    string | undefined
  >;

  const csvParams = new URLSearchParams(params);
  csvParams.set("format", "csv");
  const csvHref = `/api/receipts?${csvParams.toString()}`;

  const counts = Object.fromEntries(decisionCounts.map((d) => [d.decision, d._count._all]));

  return (
    <div className="page-container py-10">
      <div className="label">ARCHIVE</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">RECEIPTS</h1>
      <SectionSubNav group="Logs" tabs={LOGS_TABS} active="/receipts" />
      <p className="mt-4 text-paperMuted text-sm">
        Every decision MandateSeal has produced. Each row is a signed, verifiable receipt.
      </p>

      {totalAll === 0 ? (
        <div className="mt-8 paper-panel p-8 text-center">
          <div className="font-display text-paper text-xl tracking-[0.04em]">NO RECEIPTS YET</div>
          <p className="mt-3 text-paperMuted text-sm max-w-md mx-auto">
            Run a policy check on the dashboard simulator, or hit{" "}
            <code className="text-paper">POST /api/check</code> with your agent's API key.
          </p>
          <div className="mt-5">
            <Link href="/dashboard" className="command-button accent">Run a Check</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="filtered" value={total} />
            <StatTile label="approved" value={counts.APPROVED ?? 0} tone="text-green" />
            <StatTile label="blocked" value={counts.BLOCKED ?? 0} tone="text-red" />
            <StatTile label="needs approval" value={counts.NEEDS_APPROVAL ?? 0} tone="text-amber" />
          </div>

          <div className="mt-6">
            <ReceiptsFilterBar
              initial={initial}
              toolOptions={distinctTools.map((t) => t.tool)}
              actionOptions={distinctActions.map((a) => a.actionType)}
              agentOptions={agents.map((a) => ({ id: a.id, name: a.name }))}
              total={total}
              csvHref={csvHref}
            />
          </div>

          <div className="mt-6">
            {total === 0 ? (
              <div className="paper-panel p-8 text-center font-tech text-[12px] uppercase tracking-[0.18em] text-paperMuted">
                no receipts match the current filter
              </div>
            ) : (
              <ReceiptTable rows={receipts.map(publicReceipt)} />
            )}
          </div>

          <Pagination total={total} limit={limit} offset={offset} />
        </>
      )}
    </div>
  );
}
