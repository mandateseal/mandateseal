"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { ReceiptRecord } from "@/lib/receipt";

interface Step {
  step: number;
  description: string;
  receipt: ReceiptRecord;
}

const decisionTone: Record<string, string> = {
  APPROVED: "text-green",
  BLOCKED: "text-red",
  NEEDS_APPROVAL: "text-amber",
};

const decisionGlyph: Record<string, string> = {
  APPROVED: "✓",
  BLOCKED: "✗",
  NEEDS_APPROVAL: "?",
};

export function PlaygroundClient({ steps }: { steps: Step[] }) {
  const [revealed, setRevealed] = useState<number>(0); // count of fully-decided steps
  const [evaluating, setEvaluating] = useState<number | null>(null); // step currently mid-eval
  const [expandedReceipt, setExpandedReceipt] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const totals = useMemo(() => {
    const decided = steps.slice(0, revealed);
    return {
      approved: decided.filter((s) => s.receipt.decision === "APPROVED").length,
      blocked: decided.filter((s) => s.receipt.decision === "BLOCKED").length,
      needsApproval: decided.filter((s) => s.receipt.decision === "NEEDS_APPROVAL").length,
      totalCostBlocked: decided
        .filter((s) => s.receipt.decision === "BLOCKED")
        .reduce((sum, s) => sum + s.receipt.costUsd, 0),
    };
  }, [steps, revealed]);

  useEffect(() => {
    if (!playing) return;
    if (revealed >= steps.length) {
      setPlaying(false);
      setEvaluating(null);
      return;
    }
    setEvaluating(revealed + 1);
    const evalTime = 380 + Math.random() * 280;
    const t = setTimeout(() => {
      setRevealed((r) => r + 1);
      setEvaluating(null);
    }, evalTime);
    return () => clearTimeout(t);
  }, [playing, revealed, steps.length]);

  function play() {
    setRevealed(0);
    setEvaluating(null);
    setExpandedReceipt(null);
    setPlaying(true);
  }

  function skipToEnd() {
    setRevealed(steps.length);
    setEvaluating(null);
    setPlaying(false);
  }

  const done = revealed >= steps.length;

  return (
    <div className="space-y-6">
      {/* Control strip */}
      <div className="border border-line bg-ink/95 font-tech text-paper">
        <div className="border-b border-line px-4 py-2.5 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.22em] text-paperMuted">
            &gt; atlas-01 · research-budget-v1
          </span>
          <span className="text-[10px] uppercase tracking-[0.22em] text-paperMuted">
            {revealed} / {steps.length} actions
          </span>
        </div>
        <div className="px-4 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-[12px] text-paperMuted leading-relaxed max-w-md">
            Press <span className="text-amber">PLAY</span> to watch the agent attempt 8 actions.
            Each is evaluated against the mandate, signed with Ed25519, and assigned a decision.
            Receipts are real (verifiable hashes + sigs) but not persisted.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={play}
              disabled={playing}
              className="border border-line bg-ink hover:border-amber hover:text-amber disabled:opacity-50 disabled:hover:border-line disabled:hover:text-paper px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-paper transition"
            >
              {playing ? "running…" : done ? "replay" : "play"}
            </button>
            {!done && (
              <button
                type="button"
                onClick={skipToEnd}
                className="border border-line bg-ink hover:border-paper px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-paperMuted hover:text-paper transition"
              >
                skip ↓
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Action timeline */}
      <div className="border border-line bg-ink/95 font-tech text-paper">
        <div className="border-b border-line px-4 py-2.5 text-[11px] uppercase tracking-[0.22em] text-paperMuted">
          &gt; action timeline
        </div>
        <div className="divide-y divide-line">
          {steps.map((s, idx) => {
            const isRevealed = idx < revealed;
            const isEvaluating = evaluating === s.step;
            const isPending = !isRevealed && !isEvaluating;
            const tone = decisionTone[s.receipt.decision] ?? "text-paperMuted";
            const glyph = decisionGlyph[s.receipt.decision] ?? "?";
            const expanded = expandedReceipt === s.receipt.id;
            return (
              <div
                key={s.receipt.id}
                className={`px-4 py-3 transition-opacity ${isPending ? "opacity-30" : "opacity-100"}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-paperMuted shrink-0 mt-0.5">
                    [{String(s.step).padStart(2, "0")}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-paper truncate">
                      {s.description}
                    </div>
                    {isEvaluating && (
                      <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-amber">
                        evaluating policy…
                      </div>
                    )}
                    {isRevealed && (
                      <div className="mt-1 flex items-center gap-3 flex-wrap text-[10px] uppercase tracking-[0.18em]">
                        <span className={tone}>
                          {glyph} {s.receipt.decision}
                        </span>
                        <span className="text-paperMuted">
                          risk · {s.receipt.riskLevel}
                        </span>
                        {s.receipt.costUsd > 0 && (
                          <span className="text-paperMuted">
                            ${s.receipt.costUsd.toFixed(2)}
                          </span>
                        )}
                      </div>
                    )}
                    {isRevealed && (
                      <div className="mt-2 text-[11px] text-paperMuted leading-relaxed">
                        {s.receipt.reason}
                      </div>
                    )}
                    {isRevealed && (
                      <div className="mt-2 text-[10px] text-paperMuted font-mono">
                        rule · <span className="text-paper">{s.receipt.matchedRule}</span>
                      </div>
                    )}
                    {isRevealed && (
                      <div className="mt-1 text-[10px] text-paperMuted">
                        hash · <code className="text-paper">{s.receipt.receiptHash.slice(0, 16)}…</code>
                        <button
                          type="button"
                          onClick={() => setExpandedReceipt(expanded ? null : s.receipt.id)}
                          className="ml-3 uppercase tracking-[0.18em] text-paperMuted hover:text-amber transition"
                        >
                          {expanded ? "hide json ↑" : "view json ↓"}
                        </button>
                      </div>
                    )}
                    {expanded && (
                      <pre className="mt-3 border border-line bg-black/40 p-3 text-[10px] text-paper overflow-x-auto whitespace-pre">
{JSON.stringify(
  {
    id: s.receipt.id,
    agentId: s.receipt.agentId,
    mandateId: s.receipt.mandateId,
    actionType: s.receipt.actionType,
    tool: s.receipt.tool,
    target: s.receipt.target,
    costUsd: s.receipt.costUsd,
    decision: s.receipt.decision,
    reason: s.receipt.reason,
    matchedRule: s.receipt.matchedRule,
    riskLevel: s.receipt.riskLevel,
    timestamp: s.receipt.timestamp,
    policyHash: s.receipt.policyHash,
    receiptHash: s.receipt.receiptHash,
    signature: s.receipt.signature,
  },
  null,
  2,
)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary + outro */}
      <div className="border border-line bg-ink/95 font-tech text-paper">
        <div className="border-b border-line px-4 py-2.5 text-[11px] uppercase tracking-[0.22em] text-paperMuted">
          &gt; summary
        </div>
        <div className="px-4 py-4 grid grid-cols-3 gap-4 text-[11px]">
          <div>
            <div className="uppercase tracking-[0.18em] text-paperMuted">approved</div>
            <div className="mt-1 text-2xl text-green">{totals.approved}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.18em] text-paperMuted">blocked</div>
            <div className="mt-1 text-2xl text-red">{totals.blocked}</div>
          </div>
          <div>
            <div className="uppercase tracking-[0.18em] text-paperMuted">needs approval</div>
            <div className="mt-1 text-2xl text-amber">{totals.needsApproval}</div>
          </div>
        </div>
        {done && (
          <div className="border-t border-line px-4 py-4 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.18em] text-paperMuted">
              cost prevented by blocks · <span className="text-paper">${totals.totalCostBlocked.toFixed(2)}</span>
            </div>
            <div className="text-[12px] text-paperMuted leading-relaxed">
              In a real run, every receipt above would be persisted, bundled into a merkle batch,
              and broadcast onchain to Base. Trust ends at the chain, not at this server.
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <Link
                href="/anchor"
                className="border border-line bg-ink hover:border-amber hover:text-amber px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-paper transition"
              >
                see real anchors →
              </Link>
              <Link
                href="/docs"
                className="border border-line bg-ink hover:border-paper px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-paperMuted hover:text-paper transition"
              >
                integrate sdk →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
