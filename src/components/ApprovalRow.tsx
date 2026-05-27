"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtTimestamp } from "@/lib/fmt";
import type { ApprovalListItem, ApprovalStatus } from "@/lib/approval";

const statusTone: Record<ApprovalStatus, string> = {
  pending: "text-amber",
  approved: "text-green",
  denied: "text-red",
  expired: "text-paperMuted",
};

export function ApprovalRow({ approval }: { approval: ApprovalListItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [note, setNote] = useState("");
  const isPending = approval.status === "pending";
  const ttlMs = new Date(approval.expiresAt).getTime() - Date.now();
  const ttlMin = Math.max(0, Math.floor(ttlMs / 60000));

  async function decide(kind: "approve" | "deny") {
    setBusy(kind);
    try {
      const res = await fetch(`/api/approvals/${approval.id}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decidedBy: "admin", decisionNote: note || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Failed: " + (data.error ?? res.statusText));
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="ink-panel p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label">{approval.receipt.actionType.toUpperCase()}</div>
          <div className="mt-1 font-tech text-[12px] text-paperMuted">
            agent <span className="text-paper">{approval.agentId}</span>
          </div>
        </div>
        <span className={`font-tech text-[11px] uppercase tracking-[0.22em] ${statusTone[approval.status]}`}>
          ● {approval.status}
        </span>
      </header>

      <div className="dashed-rule my-4" />

      <div className="grid sm:grid-cols-2 gap-3 font-tech text-[12px]">
        <Cell k="tool" v={approval.receipt.tool} />
        <Cell k="target" v={approval.receipt.target} truncate />
        <Cell k="cost" v={`$${approval.receipt.costUsd.toFixed(2)}`} />
        <Cell k="risk" v={approval.receipt.riskLevel} />
        <Cell k="requested" v={fmtTimestamp(approval.requestedAt)} />
        <Cell k={isPending ? "expires in" : "expires at"} v={isPending ? `~${ttlMin}m` : fmtTimestamp(approval.expiresAt)} />
      </div>

      <div className="mt-3">
        <div className="label">matched rule</div>
        <code className="block mt-1 font-tech text-[12px] text-paper break-all">{approval.receipt.matchedRule}</code>
      </div>

      {!isPending && approval.decidedBy && (
        <div className="mt-3 paper-panel p-3">
          <div className="label">decision</div>
          <div className="mt-1 font-tech text-[12px] text-paper">
            {approval.status} by <span className="text-amber">{approval.decidedBy}</span> at {fmtTimestamp(approval.decidedAt)}
          </div>
          {approval.decisionNote && (
            <div className="mt-1 font-tech text-[12px] text-paperMuted">note: {approval.decisionNote}</div>
          )}
        </div>
      )}

      {isPending && (
        <>
          <div className="mt-4">
            <label>
              <span className="field-label">decision note (optional)</span>
              <input
                className="field-input"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="why this decision?"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2 flex-wrap">
            <button onClick={() => decide("approve")} disabled={busy !== null} className="command-button accent">
              {busy === "approve" ? "Approving…" : "Approve"}
            </button>
            <button onClick={() => decide("deny")} disabled={busy !== null} className="command-button">
              {busy === "deny" ? "Denying…" : "Deny"}
            </button>
          </div>
        </>
      )}
    </article>
  );
}

function Cell({ k, v, truncate }: { k: string; v: string; truncate?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="label">{k}</div>
      <div className={truncate ? "mt-1 truncate text-paper" : "mt-1 text-paper"}>{v}</div>
    </div>
  );
}
