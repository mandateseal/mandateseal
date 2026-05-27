"use client";
import { useCallback, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SegmentedFilter, type SegmentOption } from "./SegmentedFilter";

const DECISION_OPTIONS: SegmentOption[] = [
  { value: null, label: "All", tone: "neutral" },
  { value: "APPROVED", label: "Approved", tone: "approved" },
  { value: "BLOCKED", label: "Blocked", tone: "blocked" },
  { value: "NEEDS_APPROVAL", label: "Needs Approval", tone: "needs_approval" },
];
const RISK_OPTIONS: SegmentOption[] = [
  { value: null, label: "All", tone: "neutral" },
  { value: "LOW", label: "Low", tone: "low" },
  { value: "MEDIUM", label: "Medium", tone: "medium" },
  { value: "HIGH", label: "High", tone: "high" },
];

interface FilterShape {
  q?: string;
  decision?: string;
  riskLevel?: string;
  tool?: string;
  actionType?: string;
  agentId?: string;
  from?: string;
  to?: string;
  costMin?: string;
  costMax?: string;
}

export function ReceiptsFilterBar({
  initial,
  toolOptions,
  actionOptions,
  agentOptions,
  total,
  csvHref,
}: {
  initial: FilterShape;
  toolOptions: string[];
  actionOptions: string[];
  agentOptions: Array<{ id: string; name: string }>;
  total: number;
  csvHref: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Partial<FilterShape>) => {
      const next = new URLSearchParams(search?.toString() ?? "");
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "" || v === "all") next.delete(k);
        else next.set(k, v);
      }
      next.delete("offset"); // any filter change resets pagination
      startTransition(() => {
        router.replace(`${pathname}?${next.toString()}`);
      });
    },
    [router, pathname, search],
  );

  const clearAll = () => {
    startTransition(() => router.replace(pathname));
  };

  return (
    <div className="ink-panel p-4">
      <div className="flex items-end gap-3 flex-wrap">
        <Field label="search reason / rule / target" wide>
          <input
            className="field-input"
            placeholder="e.g. blockedTools, wallet, openai.com"
            defaultValue={initial.q ?? ""}
            onChange={(e) => update({ q: e.target.value })}
          />
        </Field>
        <SegmentedFilter
          label="decision"
          options={DECISION_OPTIONS}
          current={initial.decision}
          onChange={(v) => update({ decision: v ?? "" })}
        />
        <SegmentedFilter
          label="risk"
          options={RISK_OPTIONS}
          current={initial.riskLevel}
          onChange={(v) => update({ riskLevel: v ?? "" })}
        />
        <Field label="tool">
          <select className="field-input" value={initial.tool ?? "all"} onChange={(e) => update({ tool: e.target.value })}>
            <option value="all">all</option>
            {toolOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="action">
          <select className="field-input" value={initial.actionType ?? "all"} onChange={(e) => update({ actionType: e.target.value })}>
            <option value="all">all</option>
            {actionOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="agent">
          <select className="field-input" value={initial.agentId ?? "all"} onChange={(e) => update({ agentId: e.target.value })}>
            <option value="all">all</option>
            {agentOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
      </div>

      <div className="mt-3 flex items-end gap-3 flex-wrap">
        <Field label="from">
          <input
            type="datetime-local"
            className="field-input"
            defaultValue={initial.from ?? ""}
            onChange={(e) => update({ from: e.target.value ? new Date(e.target.value).toISOString() : "" })}
          />
        </Field>
        <Field label="to">
          <input
            type="datetime-local"
            className="field-input"
            defaultValue={initial.to ?? ""}
            onChange={(e) => update({ to: e.target.value ? new Date(e.target.value).toISOString() : "" })}
          />
        </Field>
        <Field label="cost ≥">
          <input
            type="number"
            min="0"
            step="0.01"
            className="field-input"
            defaultValue={initial.costMin ?? ""}
            onChange={(e) => update({ costMin: e.target.value })}
          />
        </Field>
        <Field label="cost ≤">
          <input
            type="number"
            min="0"
            step="0.01"
            className="field-input"
            defaultValue={initial.costMax ?? ""}
            onChange={(e) => update({ costMax: e.target.value })}
          />
        </Field>

        <div className="flex-1" />

        <div className="font-tech text-[11px] text-paperMuted uppercase tracking-[0.18em]">
          {pending ? "…" : <>{total} match{total === 1 ? "" : "es"}</>}
        </div>
        <a href={csvHref} className="command-button" download>Export CSV</a>
        <button type="button" onClick={clearAll} className="command-button">Clear</button>
      </div>
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "min-w-[280px] flex-1" : ""}`}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
