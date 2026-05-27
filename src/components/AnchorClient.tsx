"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtTimestamp } from "@/lib/fmt";
import type { AnchorBatchView } from "@/lib/anchor";
import { StatTile } from "./StatTile";

interface AuditResult {
  scanned: number;
  valid: number;
  invalid: number;
  failures: Array<{ batchIndex: number; reasons: string[] }>;
}

export function AnchorClient({
  initialBatches,
  initialPending,
}: {
  initialBatches: AnchorBatchView[];
  initialPending: number;
}) {
  const router = useRouter();
  const [batches, setBatches] = useState<AnchorBatchView[]>(initialBatches);
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState<"seal" | "audit" | null>(null);
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [lastSealed, setLastSealed] = useState<AnchorBatchView | null>(null);

  async function sealBatch() {
    if (pending === 0) return;
    setBusy("seal");
    try {
      const res = await fetch("/api/anchor", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Seal failed");
        return;
      }
      setBatches((prev) => [data.batch, ...prev]);
      setLastSealed(data.batch);
      setPending(0);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function runAudit() {
    setBusy("audit");
    setAudit(null);
    try {
      const res = await fetch("/api/anchor/audit", { cache: "no-store" });
      const data = await res.json();
      setAudit(data);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="ink-panel p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="label">SECTION 01</div>
            <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">SEAL NEXT BATCH</h3>
            <p className="mt-2 text-paperMuted text-sm max-w-xl">
              Bundles every receipt without an anchor into a merkle tree, persists the root, and
              links it to the previous batch's root forming a tamper-evident hash chain.
            </p>
          </div>
          <button onClick={sealBatch} disabled={busy === "seal" || pending === 0} className="command-button accent">
            {busy === "seal" ? "Sealing…" : pending === 0 ? "No pending receipts" : `Seal ${pending} receipts`}
          </button>
        </div>
        {lastSealed && (
          <div className="mt-4 paper-panel p-4 font-tech text-[12px]">
            <div className="label text-green">✓ NEW BATCH SEALED</div>
            <div className="mt-2 text-paper">
              batch #{lastSealed.batchIndex} · {lastSealed.receiptCount} receipts
            </div>
            <div className="mt-1 text-paperMuted">
              root <code className="text-paper break-all">{lastSealed.root}</code>
            </div>
          </div>
        )}
      </section>

      <section className="ink-panel p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="label">SECTION 02</div>
            <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">CHAIN INTEGRITY AUDIT</h3>
            <p className="mt-2 text-paperMuted text-sm max-w-xl">
              Recompute every batch's merkle root from its leaves and check the prev-root chain.
              Any storage tampering surfaces here.
            </p>
          </div>
          <button onClick={runAudit} disabled={busy === "audit" || batches.length === 0} className="command-button">
            {busy === "audit" ? "Auditing…" : audit ? "Re-audit" : "Run Audit"}
          </button>
        </div>
        {audit && (
          <>
            <div className="dashed-rule my-4" />
            <div className="grid grid-cols-3 gap-3 font-tech text-[12px]">
              <StatTile variant="bare" label="scanned" value={audit.scanned} />
              <StatTile variant="bare" label="valid" value={audit.valid} tone="text-green" />
              <StatTile variant="bare" label="invalid" value={audit.invalid} tone={audit.invalid > 0 ? "text-red" : "text-paperMuted"} />
            </div>
            {audit.failures.length > 0 && (
              <div className="mt-4 paper-panel p-3">
                <div className="label text-red">CHAIN BREAK</div>
                {audit.failures.map((f) => (
                  <div key={f.batchIndex} className="mt-2 font-tech text-[12px]">
                    <div className="text-paper">batch #{f.batchIndex}</div>
                    <ul className="ml-4 list-disc text-red text-[12px]">
                      {f.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {audit.invalid === 0 && audit.scanned > 0 && (
              <div className="mt-3 font-tech text-[12px] text-green">
                ✓ {audit.scanned} batches, all roots verify, prev-root chain intact
              </div>
            )}
          </>
        )}
      </section>

      <section className="ink-panel p-5">
        <div className="label">SECTION 03</div>
        <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">BATCHES · {batches.length}</h3>
        <div className="dashed-rule my-4" />
        {batches.length === 0 ? (
          <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
            no batches sealed yet — run a few policy checks then click Seal.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-tech text-[12px]">
              <thead>
                <tr className="text-left text-paperMuted">
                  <th className="px-3 py-2 label">BATCH</th>
                  <th className="px-3 py-2 label">RECEIPTS</th>
                  <th className="px-3 py-2 label">ROOT</th>
                  <th className="px-3 py-2 label">PREV ROOT</th>
                  <th className="px-3 py-2 label">SEALED AT</th>
                  <th className="px-3 py-2 label">CHAIN STATUS</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-t border-line text-paper align-top">
                    <td className="px-3 py-2">#{b.batchIndex}</td>
                    <td className="px-3 py-2">{b.receiptCount}</td>
                    <td className="px-3 py-2 break-all max-w-[220px]"><code className="text-paper">{b.root}</code></td>
                    <td className="px-3 py-2 break-all max-w-[220px]"><code className="text-paperMuted">{b.prevRoot.slice(0, 16)}…</code></td>
                    <td className="px-3 py-2 text-paperMuted whitespace-nowrap">{fmtTimestamp(b.createdAt)}</td>
                    <td className="px-3 py-2">
                      {b.txHash ? (
                        <span className="text-green">● {b.chain} · {b.txHash.slice(0, 10)}…</span>
                      ) : (
                        <span className="text-paperMuted">● local-only (v0.9.1 → broadcast to Base)</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="paper-panel p-5">
        <div className="label">VERIFY A RECEIPT ON-CHAIN (when broadcast in v0.9.1)</div>
        <p className="mt-2 text-paper text-sm">
          Get a merkle proof for any anchored receipt:
        </p>
        <pre className="mt-3 ink-panel p-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{`# 1. fetch proof
curl http://localhost:3000/api/anchor/proof?receiptId=rct_xxx

# 2. verify standalone (no DB)
curl -X POST http://localhost:3000/api/anchor/verify \\
  -H "content-type: application/json" \\
  -d '{ "receiptHash": "...", "proof": [...], "root": "..." }'`}
        </pre>
        <p className="mt-3 text-paperMuted text-sm">
          Once v0.9.1 broadcasts roots to Base, the same proof verifies against the on-chain root
          read from the anchor contract — no MandateSeal contact required.
        </p>
      </section>
    </div>
  );
}

