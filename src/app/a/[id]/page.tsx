import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { publicReceipt, redactedReceipt } from "@/lib/serialize";
import { StatTile } from "@/components/StatTile";
import { fmtTimestamp } from "@/lib/fmt";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

const RECENT_LIMIT = 20;

async function loadAgent(id: string) {
  const agent = await prisma.agent.findUnique({
    where: { id },
    select: { id: true, name: true, role: true, status: true, createdAt: true },
  });
  if (!agent) return null;

  const [counts, totals, recent] = await Promise.all([
    prisma.receipt.groupBy({
      by: ["decision"],
      where: { agentId: id },
      _count: { _all: true },
    }),
    prisma.receipt.aggregate({
      where: { agentId: id },
      _sum: { costUsd: true },
      _count: { _all: true },
    }),
    prisma.receipt.findMany({
      where: { agentId: id },
      orderBy: { timestamp: "desc" },
      take: RECENT_LIMIT,
    }),
  ]);

  return {
    agent,
    counts: Object.fromEntries(counts.map((c) => [c.decision, c._count._all])) as Record<string, number>,
    total: totals._count._all,
    totalCostUsd: totals._sum.costUsd ?? 0,
    recent: recent.map(publicReceipt).map(redactedReceipt),
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const data = await loadAgent(params.id);
  if (!data) return { title: "Agent not found · MandateSeal" };
  const blocked = data.counts.BLOCKED ?? 0;
  const blockedRate = data.total === 0 ? 0 : Math.round((blocked / data.total) * 100);
  const title = `${data.agent.name} · MandateSeal Agent Profile`;
  const description = `${data.agent.role}. ${data.total} decisions sealed, ${blockedRate}% blocked. Public audit log.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "profile", images: ["/mandateseal-mark.svg"] },
    twitter: { card: "summary", title, description, images: ["/mandateseal-mark.svg"] },
  };
}

const decisionTone: Record<string, string> = {
  APPROVED: "text-green",
  BLOCKED: "text-red",
  NEEDS_APPROVAL: "text-amber",
};

export default async function PublicAgentPage({ params }: PageProps) {
  const data = await loadAgent(params.id);
  if (!data) notFound();

  const { agent, counts, total, totalCostUsd, recent } = data;
  const approved = counts.APPROVED ?? 0;
  const blocked = counts.BLOCKED ?? 0;
  const needs = counts.NEEDS_APPROVAL ?? 0;
  const blockedRate = total === 0 ? 0 : Math.round((blocked / total) * 100);

  return (
    <div className="page-container py-10 max-w-4xl space-y-6">
      <header>
        <div className="label">PUBLIC AGENT</div>
        <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">{agent.name}</h1>
        <p className="mt-2 text-paperMuted text-sm">
          {agent.role} · status <span className="text-green">{agent.status}</span> · registered{" "}
          {fmtTimestamp(agent.createdAt.toISOString())}
        </p>
        <div className="mt-2 font-tech text-[11px] text-paperMuted">
          id <code className="text-paper">{agent.id}</code>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="total decisions" value={total} />
        <StatTile label="approved" value={approved} tone="text-green" />
        <StatTile label="blocked" value={blocked} tone="text-red" />
        <StatTile label="needs approval" value={needs} tone="text-amber" />
        <StatTile label="total cost (usd)" value={`$${totalCostUsd.toFixed(2)}`} />
      </section>

      <section className="ink-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label">RECENT</div>
            <h2 className="font-display text-paper text-xl tracking-[0.04em] mt-1">
              LAST {recent.length} RECEIPTS
            </h2>
          </div>
          <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
            blocked rate · {blockedRate}%
          </div>
        </div>
        <div className="dashed-rule my-4" />
        {recent.length === 0 ? (
          <div className="font-tech text-[11px] text-paperMuted uppercase tracking-[0.18em]">
            this agent has not sealed any receipts yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {recent.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/r/${r.id}`}
                  className="flex items-center justify-between gap-4 hover:bg-paper/[0.04] -mx-3 px-3 py-2 transition"
                >
                  <span className="font-tech text-[12px] text-paperMuted whitespace-nowrap">
                    {fmtTimestamp(r.timestamp)}
                  </span>
                  <span className={`font-tech text-[12px] ${decisionTone[r.decision] ?? "text-paper"} whitespace-nowrap`}>
                    {r.decision}
                  </span>
                  <span className="font-tech text-[12px] text-paper truncate flex-1">
                    {r.actionType}
                  </span>
                  <span className="font-tech text-[11px] text-paperMuted truncate hidden md:inline flex-1">
                    {r.target}
                  </span>
                  <span className="font-tech text-[11px] text-paperMuted whitespace-nowrap">
                    ${r.costUsd.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="paper-panel p-5">
        <div className="label">VERIFY THIS AGENT'S RECEIPTS</div>
        <p className="mt-2 text-paper text-sm">
          MandateSeal's Ed25519 public key is at{" "}
          <a href="/api/key.pub" className="text-amber hover:underline">/api/key.pub</a>.
          Any receipt issued for this agent can be verified offline using that key — see the{" "}
          <Link href="/docs" className="text-amber hover:underline">docs</Link> for the one-liner.
        </p>
      </section>
    </div>
  );
}
