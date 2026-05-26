import {
  ROADMAP,
  CROSS_CUTTING,
  ORDER_TRADEOFFS,
  STATUS_LABEL,
  type VersionStatus,
} from "@/lib/roadmap";

const statusToneClass: Record<VersionStatus, string> = {
  shipped: "text-green border-green",
  next: "text-amber border-amber",
  planned: "text-paper border-line",
  later: "text-paperMuted border-line",
};

export default function RoadmapPage() {
  return (
    <div className="page-container py-10 max-w-5xl">
      <div className="label">PLAN OF RECORD</div>
      <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">ROADMAP</h1>
      <p className="mt-2 text-paperMuted text-sm max-w-2xl">
        Where MandateSeal is going. Each version has a single sharpened goal — ship that, then move on.
        Single source of truth lives in <code className="text-paper">src/lib/roadmap.ts</code>.
      </p>

      <section className="mt-10 space-y-5">
        {ROADMAP.map((v) => (
          <article key={v.version} className="ink-panel p-5">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-tech text-[10px] text-paperMuted tracking-[0.22em]">
                  // {v.version}
                </div>
                <h2 className="font-display text-paper text-xl md:text-2xl tracking-[0.04em] mt-1">
                  {v.name}
                </h2>
              </div>
              <span
                className={`stamp-badge ${statusToneClass[v.status]}`}
                style={{ transform: "rotate(-2deg)" }}
              >
                {STATUS_LABEL[v.status]}
              </span>
            </header>

            <p className="mt-4 text-paper text-sm leading-relaxed italic">{v.oneLine}</p>

            <div className="dashed-rule my-4" />

            <Block label="Goal" value={v.goal} />

            <div className="mt-4">
              <div className="label">Ships</div>
              <ul className="mt-2 space-y-1.5 text-paper text-sm">
                {v.ships.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-paperMuted font-tech text-[11px] mt-0.5">›</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <Block label="Success criteria" value={v.successCriteria} />
              <Block label="Effort" value={v.effort} mono />
            </div>

            {v.dependsOn && (
              <div className="mt-4">
                <Block label="Depends on" value={v.dependsOn} mono />
              </div>
            )}
          </article>
        ))}
      </section>

      <section className="mt-12">
        <div className="label">CROSS-CUTTING CONCERNS</div>
        <h2 className="font-display text-paper text-xl mt-2 tracking-[0.04em]">
          THINGS THAT LIVE BETWEEN VERSIONS
        </h2>
        <div className="mt-4 ink-panel overflow-x-auto">
          <table className="w-full font-tech text-[12px]">
            <thead>
              <tr className="text-left text-paperMuted">
                <th className="px-4 py-3 label">CONCERN</th>
                <th className="px-4 py-3 label">SLOT</th>
                <th className="px-4 py-3 label">WHY</th>
              </tr>
            </thead>
            <tbody>
              {CROSS_CUTTING.map((c) => (
                <tr key={c.concern} className="border-t border-line text-paper">
                  <td className="px-4 py-3">{c.concern}</td>
                  <td className="px-4 py-3 text-amber">{c.slot}</td>
                  <td className="px-4 py-3 text-paperMuted">{c.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <div className="label">ORDER TRADE-OFFS</div>
        <h2 className="font-display text-paper text-xl mt-2 tracking-[0.04em]">
          WORTH RECONSIDERING
        </h2>
        <div className="mt-4 grid md:grid-cols-3 gap-4">
          {ORDER_TRADEOFFS.map((t) => (
            <div key={t.title} className="paper-panel p-4">
              <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-amber">
                {t.title}
              </div>
              <p className="mt-2 text-paper text-sm leading-relaxed">{t.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Block({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={mono ? "mt-1 font-tech text-[12px] text-paper" : "mt-1 text-paper text-sm leading-relaxed"}>
        {value}
      </div>
    </div>
  );
}
