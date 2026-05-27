import Link from "next/link";
import { listAgentSpend } from "@/lib/spend";
import { StatTile } from "@/components/StatTile";
import { SectionSubNav, LOGS_TABS } from "@/components/SectionSubNav";
import { fmtTimestamp } from "@/lib/fmt";

export const dynamic = "force-dynamic";

export default async function SpendPage() {
  const rows = await listAgentSpend();

  const totals = rows.reduce(
    (acc, r) => ({
      today: acc.today + r.todayUsd,
      week: acc.week + r.weekUsd,
      month: acc.month + r.monthUsd,
      total: acc.total + r.totalUsd,
    }),
    { today: 0, week: 0, month: 0, total: 0 },
  );

  const overBudget = rows.filter((r) => r.dailyBudgetUsd > 0 && r.todayPctOfBudget >= 1);

  return (
    <div className="page-container py-10 space-y-6">
      <header>
        <div className="label">LEDGER</div>
        <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">SPEND</h1>
        <SectionSubNav group="Logs" tabs={LOGS_TABS} active="/spend" />
        <p className="mt-4 text-paperMuted text-sm max-w-2xl">
          Per-agent cost of approved actions across today (UTC), the last 7 days, the last 30 days,
          and total. Daily budget enforcement is hard-cap — agents are blocked when{" "}
          <code className="text-paper">today + this {">"} dailyBudgetUsd</code>.
        </p>
        <div className="mt-2 font-tech text-[10px] text-paperMuted uppercase tracking-[0.22em]">
          generated at {fmtTimestamp(new Date().toISOString())}
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="today (usd)" value={`$${totals.today.toFixed(2)}`} />
        <StatTile label="last 7d (usd)" value={`$${totals.week.toFixed(2)}`} />
        <StatTile label="last 30d (usd)" value={`$${totals.month.toFixed(2)}`} />
        <StatTile label="all-time (usd)" value={`$${totals.total.toFixed(2)}`} />
      </section>

      {overBudget.length > 0 && (
        <section className="paper-panel p-5 border-l-4 border-red">
          <div className="label text-red">⚠ OVER DAILY BUDGET</div>
          <ul className="mt-2 space-y-1 font-tech text-[12px] text-paper">
            {overBudget.map((r) => (
              <li key={r.agentId}>
                <Link href={`/a/${r.agentId}`} className="hover:underline">{r.agentName}</Link>{" "}
                — spent ${r.todayUsd.toFixed(2)} of ${r.dailyBudgetUsd.toFixed(2)} (
                {Math.round(r.todayPctOfBudget * 100)}%)
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ink-panel p-5">
        <div className="label">SECTION 01</div>
        <h2 className="font-display text-paper text-xl tracking-[0.04em] mt-1">PER AGENT</h2>
        <div className="dashed-rule my-4" />
        {rows.length === 0 ? (
          <div className="font-tech text-[11px] text-paperMuted uppercase tracking-[0.18em]">
            no agents registered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-tech text-[12px]">
              <thead>
                <tr className="text-left text-paperMuted">
                  <th className="px-3 py-2 label">AGENT</th>
                  <th className="px-3 py-2 label text-right">BUDGET / DAY</th>
                  <th className="px-3 py-2 label text-right">TODAY</th>
                  <th className="px-3 py-2 label text-right">% BUDGET</th>
                  <th className="px-3 py-2 label text-right">LAST 7D</th>
                  <th className="px-3 py-2 label text-right">LAST 30D</th>
                  <th className="px-3 py-2 label text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = Math.round(r.todayPctOfBudget * 100);
                  const tone =
                    r.dailyBudgetUsd === 0
                      ? "text-paperMuted"
                      : r.todayPctOfBudget >= 1
                      ? "text-red"
                      : r.todayPctOfBudget >= 0.8
                      ? "text-amber"
                      : "text-green";
                  return (
                    <tr key={r.agentId} className="border-t border-line text-paper">
                      <td className="px-3 py-2">
                        <Link href={`/a/${r.agentId}`} className="hover:underline">{r.agentName}</Link>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.dailyBudgetUsd === 0 ? <span className="text-paperMuted">none</span> : `$${r.dailyBudgetUsd.toFixed(2)}`}
                      </td>
                      <td className="px-3 py-2 text-right">${r.todayUsd.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right ${tone}`}>
                        {r.dailyBudgetUsd === 0 ? "—" : `${pct}%`}
                      </td>
                      <td className="px-3 py-2 text-right">${r.weekUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">${r.monthUsd.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">${r.totalUsd.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
