"use client";
import { useState } from "react";
import { StatTile } from "./StatTile";

interface IntegrityFailure {
  id: string;
  agentId: string;
  timestamp: string;
  reasons: string[];
}

interface IntegrityResult {
  scanned: number;
  valid: number;
  invalid: number;
  integrity: number;
  durationMs: number;
  truncated: boolean;
  failures: IntegrityFailure[];
}

export function IntegrityCard() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntegrityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/audit/integrity", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ink-panel p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="label">SECTION 01</div>
          <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">INTEGRITY CHECK</h3>
          <p className="mt-2 text-paperMuted text-sm max-w-xl">
            Recomputes the canonical hash and Ed25519 signature for every receipt in the archive.
            Any tampered or corrupted row is reported below.
          </p>
        </div>
        <button onClick={run} disabled={busy} className="command-button accent">
          {busy ? "Scanning…" : result ? "Re-scan" : "Run Scan"}
        </button>
      </div>

      {error && (
        <div className="mt-4 font-tech text-[11px] uppercase tracking-[0.18em] text-red">{error}</div>
      )}

      {result && (
        <>
          <div className="dashed-rule my-5" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile variant="bare" label="scanned" value={result.scanned} />
            <StatTile variant="bare" label="valid" value={result.valid} tone="text-green" />
            <StatTile variant="bare" label="invalid" value={result.invalid} tone={result.invalid > 0 ? "text-red" : "text-paperMuted"} />
            <StatTile variant="bare" label="integrity" value={`${(result.integrity * 100).toFixed(1)}%`} tone={result.integrity === 1 ? "text-green" : "text-amber"} />
          </div>
          <div className="mt-3 font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
            duration {result.durationMs}ms{result.truncated ? " · result truncated, raise ?limit=" : ""}
          </div>

          {result.failures.length > 0 && (
            <div className="mt-5">
              <div className="label text-red">FAILURES</div>
              <div className="mt-2 space-y-2">
                {result.failures.map((f) => (
                  <div key={f.id} className="paper-panel p-3 font-tech text-[12px]">
                    <div className="flex justify-between text-paper">
                      <code>{f.id}</code>
                      <span className="text-paperMuted">{f.timestamp.replace("T", " ").slice(0, 19)}</span>
                    </div>
                    <ul className="mt-1 list-disc list-inside text-red text-[12px]">
                      {f.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.invalid === 0 && result.scanned > 0 && (
            <div className="mt-5 paper-panel p-4 font-tech text-[12px] text-green">
              ✓ Every receipt verified. The signing key is consistent and no row has been tampered with.
            </div>
          )}
        </>
      )}
    </div>
  );
}

