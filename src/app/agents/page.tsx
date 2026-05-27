import Link from "next/link";
import { prisma } from "@/lib/db";
import { publicAgent } from "@/lib/serialize";
import { AgentRow } from "@/components/AgentRow";
import { SectionSubNav, AGENTS_TABS } from "@/components/SectionSubNav";
import { calculateReputation, type ReputationResult } from "@/lib/reputation";

export const dynamic = "force-dynamic";

async function loadReputationMap(ids: string[]): Promise<Record<string, ReputationResult>> {
  if (ids.length === 0) return {};
  const [byDecision, anchorCounts, spans] = await Promise.all([
    prisma.receipt.groupBy({
      by: ["agentId", "decision"],
      where: { agentId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.receipt.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids }, anchorBatchId: { not: null } },
      _count: { _all: true },
    }),
    prisma.receipt.groupBy({
      by: ["agentId"],
      where: { agentId: { in: ids } },
      _min: { timestamp: true },
      _max: { timestamp: true },
      _count: { _all: true },
    }),
  ]);

  type Stat = {
    approved: number;
    blocked: number;
    needsApproval: number;
    anchored: number;
    total: number;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
  };
  const stats: Record<string, Stat> = {};
  const init = (): Stat => ({
    approved: 0,
    blocked: 0,
    needsApproval: 0,
    anchored: 0,
    total: 0,
    firstSeenAt: null,
    lastSeenAt: null,
  });
  for (const id of ids) stats[id] = init();
  for (const r of byDecision) {
    const s = stats[r.agentId] ?? (stats[r.agentId] = init());
    if (r.decision === "APPROVED") s.approved += r._count._all;
    else if (r.decision === "BLOCKED") s.blocked += r._count._all;
    else if (r.decision === "NEEDS_APPROVAL") s.needsApproval += r._count._all;
  }
  for (const r of anchorCounts) {
    (stats[r.agentId] ?? init()).anchored = r._count._all;
  }
  for (const r of spans) {
    const s = stats[r.agentId] ?? (stats[r.agentId] = init());
    s.total = r._count._all;
    s.firstSeenAt = r._min.timestamp;
    s.lastSeenAt = r._max.timestamp;
  }

  const out: Record<string, ReputationResult> = {};
  for (const id of ids) {
    out[id] = calculateReputation(stats[id]);
  }
  return out;
}

const tierTone: Record<string, string> = {
  TRUSTED: "text-green",
  ACTIVE: "text-amber",
  EMERGING: "text-paper",
  NEW: "text-paperMuted",
};

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: "asc" } });
  const repMap = await loadReputationMap(agents.map((a) => a.id));

  return (
    <div className="page-container py-10">
      <div className="label">REGISTRY</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">AGENTS</h1>
      <SectionSubNav group="Agents" tabs={AGENTS_TABS} active="/agents" />
      <p className="mt-4 text-paperMuted text-sm max-w-2xl">
        Every autonomous agent registered with MandateSeal. Raw API keys are shown once at creation
        and once at rotation, never again.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/dashboard" className="command-button accent">Create / Manage on Dashboard</Link>
      </div>

      {agents.length === 0 ? (
        <div className="mt-8 paper-panel p-8 text-center">
          <div className="font-display text-paper text-xl tracking-[0.04em]">NO AGENTS YET</div>
          <p className="mt-3 text-paperMuted text-sm max-w-md mx-auto">
            Run <code className="text-paper">npm run db:seed</code> to provision the demo Atlas-01 agent,
            or use <code className="text-paper">POST /api/agents</code> / the dashboard to create one.
          </p>
          <div className="mt-5">
            <Link href="/dashboard" className="command-button accent">Open Dashboard</Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 ink-panel overflow-x-auto">
          <table className="w-full font-tech text-[12px]">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3 label">NAME</th>
                <th className="px-4 py-3 label">ROLE</th>
                <th className="px-4 py-3 label">ID</th>
                <th className="px-4 py-3 label">STATUS</th>
                <th className="px-4 py-3 label">REPUTATION</th>
                <th className="px-4 py-3 label">CREATED</th>
                <th className="px-4 py-3 label">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(publicAgent).map((a) => (
                <AgentRow
                  key={a.id}
                  agent={a}
                  reputation={repMap[a.id]}
                  reputationTone={tierTone[repMap[a.id]?.tier ?? "NEW"] ?? "text-paperMuted"}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
