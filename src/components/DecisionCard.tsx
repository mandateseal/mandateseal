"use client";
import { StampBadge } from "./StampBadge";
import { fmtTimestamp } from "@/lib/fmt";

type Decision = "APPROVED" | "BLOCKED" | "NEEDS_APPROVAL";
type Risk = "LOW" | "MEDIUM" | "HIGH";

export function DecisionCard({
  decision,
  reason,
  matchedRule,
  riskLevel,
  timestamp,
}: {
  decision: Decision;
  reason: string;
  matchedRule: string;
  riskLevel: Risk;
  timestamp?: string;
}) {
  return (
    <div className="ink-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">SECTION 04</div>
          <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">DECISION</h3>
        </div>
        <StampBadge status={decision} />
      </div>
      <div className="dashed-rule my-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <Row k="reason" v={reason} />
        <Row k="matched rule" v={matchedRule} mono />
        <Row k="risk level" v={riskLevel} />
        <Row k="timestamp" v={fmtTimestamp(timestamp)} />
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="label mb-1">{k}</div>
      <div className={mono ? "font-tech text-[12px] text-paper break-all" : "text-paper text-sm"}>{v}</div>
    </div>
  );
}
