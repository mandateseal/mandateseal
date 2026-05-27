import Link from "next/link";
import { prisma } from "@/lib/db";
import { publicMandate } from "@/lib/serialize";
import { SectionSubNav, AGENTS_TABS } from "@/components/SectionSubNav";

export const dynamic = "force-dynamic";

export default async function MandatesPage() {
  const mandates = await prisma.mandate.findMany({
    orderBy: { createdAt: "desc" },
    include: { agent: true },
  });

  return (
    <div className="page-container py-10">
      <div className="label">POLICY</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">MANDATES</h1>
      <SectionSubNav group="Agents" tabs={AGENTS_TABS} active="/mandates" />
      <p className="mt-4 text-paperMuted text-sm">
        A mandate is the contract that constrains what an agent may do. Edit on the dashboard.
      </p>
      <div className="mt-6">
        <Link href="/dashboard" className="command-button accent">Edit on Dashboard</Link>
      </div>

      {mandates.length === 0 ? (
        <div className="mt-8 paper-panel p-8 text-center">
          <div className="font-display text-paper text-xl tracking-[0.04em]">NO MANDATES YET</div>
          <p className="mt-3 text-paperMuted text-sm max-w-md mx-auto">
            Every agent must have at least one mandate before <code className="text-paper">/api/check</code>{" "}
            can decide anything. New agents created via the dashboard get a sensible default automatically.
          </p>
          <div className="mt-5">
            <Link href="/dashboard" className="command-button accent">Create on Dashboard</Link>
          </div>
        </div>
      ) : (
      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        {mandates.map((m) => {
          const pm = publicMandate(m);
          return (
            <div key={m.id} className="ink-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="label">{m.enabled ? "ENABLED" : "DISABLED"}</div>
                  <h3 className="font-display text-paper text-lg mt-1">{pm.name}</h3>
                </div>
                <span className="font-tech text-[10px] text-paperMuted">{m.agent.name}</span>
              </div>
              <div className="dashed-rule my-3" />
              <div className="grid grid-cols-3 gap-3 font-tech text-[12px] text-paper">
                <Stat k="daily budget" v={`$${pm.dailyBudgetUsd.toFixed(2)}`} />
                <Stat k="max per action" v={`$${pm.maxCostPerActionUsd.toFixed(2)}`} />
                <Stat k="approval ≥" v={`$${pm.approvalThresholdUsd.toFixed(2)}`} />
              </div>
              <div className="dashed-rule my-3" />
              <ListGroup title="allowed tools" tone="text-green" items={pm.allowedTools} />
              <ListGroup title="blocked tools" tone="text-red" items={pm.blockedTools} />
              <ListGroup title="blocked actions" tone="text-red" items={pm.blockedActions} />
              <ListGroup title="approval required actions" tone="text-amber" items={pm.approvalRequiredActions} />
              <ListGroup title="allowed domains" tone="text-green" items={pm.allowedDomains} />
              <ListGroup title="blocked domains" tone="text-red" items={pm.blockedDomains} />
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className="mt-1">{v}</div>
    </div>
  );
}

function ListGroup({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <div className="label">{title}</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {items.map((i) => (
          <span key={i} className="tag">
            <span className={tone}>{i}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
