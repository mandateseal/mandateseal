import Link from "next/link";
import { computeAuditStats } from "@/lib/audit";
import { IntegrityCard } from "@/components/IntegrityCard";
import { StatTile } from "@/components/StatTile";
import { SectionSubNav, LOGS_TABS } from "@/components/SectionSubNav";
import { fmtTimestamp } from "@/lib/fmt";

export const dynamic = "force-dynamic";

const decisionTone: Record<string, string> = {
  APPROVED: "text-green",
  BLOCKED: "text-red",
  NEEDS_APPROVAL: "text-amber",
};

export default async function AuditPage() {
  const stats = await computeAuditStats();
  const now = fmtTimestamp(new Date().toISOString());

  return (
    <div className="page-container py-10 space-y-6">
      <header>
        <div className="label">FORENSICS</div>
        <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">AUDIT</h1>
        <SectionSubNav group="Logs" tabs={LOGS_TABS} active="/audit" />
        <p className="mt-4 text-paperMuted text-sm max-w-2xl">
          Forensic view of every decision MandateSeal has sealed. Re-verify signatures, see which
          rules fire, which agents drive cost, and which mandates are tightest.
        </p>
        <div className="mt-2 font-tech text-[10px] text-paperMuted uppercase tracking-[0.22em]">
          generated at {now}
        </div>
      </header>

      <IntegrityCard />

      {stats.total === 0 ? (
        <div className="paper-panel p-8 text-center">
          <div className="font-display text-paper text-xl tracking-[0.04em]">NO DATA YET</div>
          <p className="mt-3 text-paperMuted text-sm">Run some policy checks first to populate the audit log.</p>
          <div className="mt-5">
            <Link href="/dashboard" className="command-button accent">Open Dashboard</Link>
          </div>
        </div>
      ) : (
        <>
          <section className="ink-panel p-5">
            <div className="label">SECTION 02</div>
            <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">TOTALS</h3>
            <div className="dashed-rule my-4" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile variant="paper" label="total receipts" value={stats.total} />
              <StatTile variant="paper" label="total cost (usd)" value={`$${stats.totalCostUsd.toFixed(2)}`} />
              {stats.byDecision.map((d) => (
                <StatTile
                  key={d.decision}
                  variant="paper"
                  label={d.decision.toLowerCase().replace("_", " ")}
                  value={d.count}
                  tone={decisionTone[d.decision] ?? "text-paper"}
                />
              ))}
            </div>
          </section>

          <section className="ink-panel p-5">
            <div className="label">SECTION 03</div>
            <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">PER AGENT</h3>
            <div className="dashed-rule my-4" />
            <div className="overflow-x-auto">
              <table className="w-full font-tech text-[12px]">
                <thead>
                  <tr className="text-left text-paperMuted">
                    <th className="px-3 py-2 label">AGENT</th>
                    <th className="px-3 py-2 label text-right">TOTAL</th>
                    <th className="px-3 py-2 label text-right text-green">APPROVED</th>
                    <th className="px-3 py-2 label text-right text-red">BLOCKED</th>
                    <th className="px-3 py-2 label text-right text-amber">NEEDS APPROVAL</th>
                    <th className="px-3 py-2 label text-right">BLOCKED RATE</th>
                    <th className="px-3 py-2 label text-right">TOTAL COST</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perAgent.map((a) => {
                    const rate = a.total === 0 ? 0 : a.blocked / a.total;
                    return (
                      <tr key={a.agentId} className="border-t border-line text-paper">
                        <td className="px-3 py-2 truncate">
                          <Link href={`/receipts?agentId=${a.agentId}`} className="hover:underline">
                            <code>{a.agentId}</code>
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-right">{a.total}</td>
                        <td className="px-3 py-2 text-right text-green">{a.approved}</td>
                        <td className="px-3 py-2 text-right text-red">{a.blocked}</td>
                        <td className="px-3 py-2 text-right text-amber">{a.needsApproval}</td>
                        <td className="px-3 py-2 text-right">{(rate * 100).toFixed(0)}%</td>
                        <td className="px-3 py-2 text-right">${a.totalCostUsd.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid md:grid-cols-3 gap-4">
            <ListPanel
              title="TOP MATCHED RULES"
              section="04"
              rows={stats.topMatchedRules.map((r) => ({ key: r.rule, value: r.count }))}
              keyClass="font-tech text-[12px] text-paper break-all"
            />
            <ListPanel
              title="TOP TOOLS"
              section="05"
              rows={stats.topTools.map((r) => ({ key: r.tool, value: r.count }))}
              keyClass="font-tech text-[12px] text-paper"
            />
            <ListPanel
              title="TOP ACTIONS"
              section="06"
              rows={stats.topActions.map((r) => ({ key: r.actionType, value: r.count }))}
              keyClass="font-tech text-[12px] text-paper"
            />
          </div>
        </>
      )}
    </div>
  );
}

function ListPanel({
  title,
  section,
  rows,
  keyClass,
}: {
  title: string;
  section: string;
  rows: Array<{ key: string; value: number }>;
  keyClass: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="ink-panel p-5">
      <div className="label">SECTION {section}</div>
      <h3 className="font-display text-paper text-base tracking-[0.04em] mt-1">{title}</h3>
      <div className="dashed-rule my-3" />
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-3">
            <span className={keyClass}>{r.key}</span>
            <span className="font-tech text-[12px] text-paperMuted">{r.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
