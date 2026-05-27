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

function explorerTxUrl(chain: string | null, txHash: string | null): string | null {
  if (!chain || !txHash) return null;
  if (chain === "base") return `https://basescan.org/tx/${txHash}`;
  if (chain === "base-sepolia") return `https://sepolia.basescan.org/tx/${txHash}`;
  return null;
}

export function AnchorClient({
  initialBatches,
  initialPending,
  onchainConfigured,
}: {
  initialBatches: AnchorBatchView[];
  initialPending: number;
  onchainConfigured: boolean;
}) {
  const router = useRouter();
  const [batches, setBatches] = useState<AnchorBatchView[]>(initialBatches);
  const [pending, setPending] = useState(initialPending);
  const [busy, setBusy] = useState<"seal" | "audit" | string | null>(null);
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
      if (data.broadcastError) alert(`Sealed, but onchain broadcast failed: ${data.broadcastError}`);
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

  async function broadcastBatch(id: string) {
    setBusy(`bc-${id}`);
    try {
      const res = await fetch(`/api/anchor/${id}/broadcast`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Broadcast failed");
        return;
      }
      setBatches((prev) => prev.map((b) => (b.id === id ? data.batch : b)));
      router.refresh();
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
              {onchainConfigured && " Each new batch is broadcast to chain automatically."}
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
                {batches.map((b) => {
                  const url = explorerTxUrl(b.chain, b.txHash);
                  return (
                    <tr key={b.id} className="border-t border-line text-paper align-top">
                      <td className="px-3 py-2">#{b.batchIndex}</td>
                      <td className="px-3 py-2">{b.receiptCount}</td>
                      <td className="px-3 py-2 break-all max-w-[220px]"><code className="text-paper">{b.root}</code></td>
                      <td className="px-3 py-2 break-all max-w-[220px]"><code className="text-paperMuted">{b.prevRoot.slice(0, 16)}…</code></td>
                      <td className="px-3 py-2 text-paperMuted whitespace-nowrap">{fmtTimestamp(b.createdAt)}</td>
                      <td className="px-3 py-2">
                        {url ? (
                          <a href={url} target="_blank" rel="noreferrer" className="text-green hover:underline">
                            ● {b.chain} · {b.txHash!.slice(0, 10)}… ↗
                          </a>
                        ) : onchainConfigured ? (
                          <button
                            onClick={() => broadcastBatch(b.id)}
                            disabled={busy === `bc-${b.id}`}
                            className="text-amber hover:underline disabled:opacity-50"
                          >
                            {busy === `bc-${b.id}` ? "broadcasting…" : "● broadcast onchain"}
                          </button>
                        ) : (
                          <span className="text-paperMuted">● local-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="paper-panel p-5">
        <div className="label">VERIFY A RECEIPT{onchainConfigured ? " — ON-CHAIN" : ""}</div>
        <p className="mt-2 text-paper text-sm">
          Get a merkle proof for any anchored receipt, then verify against the stored root
          {onchainConfigured && " — or against the root fetched from the broadcast tx"}.
        </p>
        <pre className="mt-3 ink-panel p-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{`# 1. fetch proof
curl /api/anchor/proof?receiptId=rct_xxx

# 2. verify standalone (no DB)
curl -X POST /api/anchor/verify \\
  -H "content-type: application/json" \\
  -d '{ "receiptHash": "...", "proof": [...], "root": "..." }'${
  onchainConfigured
    ? `

# 3. confirm the root came from us, onchain
curl /api/anchor/{batchId}/verify-onchain`
    : ""
}`}
        </pre>
      </section>
    </div>
  );
}
