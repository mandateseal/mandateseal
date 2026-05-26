"use client";
import { useState } from "react";
import type { ReceiptView } from "@/lib/serialize";
import { fmtTimestamp } from "@/lib/fmt";

const decisionColor: Record<ReceiptView["decision"], string> = {
  APPROVED: "text-green",
  BLOCKED: "text-red",
  NEEDS_APPROVAL: "text-amber",
};

export function ReceiptTable({ rows }: { rows: ReceiptView[] }) {
  const [verifying, setVerifying] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, boolean>>({});

  async function verify(id: string) {
    setVerifying(id);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      setVerified((v) => ({ ...v, [id]: !!data.valid }));
    } finally {
      setVerifying(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="paper-panel p-6 text-center font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
        no receipts yet — run a policy check to generate one.
      </div>
    );
  }

  return (
    <div className="ink-panel overflow-x-auto">
      <table className="w-full font-tech text-[12px]">
        <thead>
          <tr className="text-left text-paperMuted">
            <th className="px-4 py-3 label">TIME</th>
            <th className="px-4 py-3 label">AGENT</th>
            <th className="px-4 py-3 label">ACTION</th>
            <th className="px-4 py-3 label">DECISION</th>
            <th className="px-4 py-3 label">RISK</th>
            <th className="px-4 py-3 label">HASH</th>
            <th className="px-4 py-3 label">VERIFY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-line text-paper">
              <td className="px-4 py-3 whitespace-nowrap">{fmtTimestamp(r.timestamp)}</td>
              <td className="px-4 py-3">{r.agentId}</td>
              <td className="px-4 py-3">{r.actionType}</td>
              <td className={`px-4 py-3 ${decisionColor[r.decision]}`}>{r.decision}</td>
              <td className="px-4 py-3">{r.riskLevel}</td>
              <td className="px-4 py-3"><code className="text-paperMuted">{r.receiptHash.slice(0, 14)}…</code></td>
              <td className="px-4 py-3">
                <button className="command-button" onClick={() => verify(r.id)} disabled={verifying === r.id}>
                  {verifying === r.id
                    ? "…"
                    : r.id in verified
                      ? (verified[r.id] ? "✓ valid" : "✗ invalid")
                      : "Verify"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
