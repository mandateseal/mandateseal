"use client";
import { useState } from "react";

export function VerifyClient() {
  const [byId, setById] = useState("");
  const [json, setJson] = useState("");
  const [result, setResult] = useState<null | { valid: boolean; reasons: string[]; receipt?: unknown }>(null);
  const [busy, setBusy] = useState(false);

  async function verifyById() {
    if (!byId.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: byId.trim() }),
      });
      const data = await res.json();
      setResult({ valid: !!data.valid, reasons: data.reasons ?? [], receipt: data.receipt });
    } catch (e) {
      setResult({ valid: false, reasons: [(e as Error).message] });
    } finally {
      setBusy(false);
    }
  }

  async function verifyJson() {
    if (!json.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setResult({ valid: false, reasons: ["Invalid JSON"] });
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setResult({ valid: !!data.valid, reasons: data.reasons ?? [] });
    } catch (e) {
      setResult({ valid: false, reasons: [(e as Error).message] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="ink-panel p-5">
        <div className="label">A · BY RECEIPT ID</div>
        <h3 className="font-display text-paper text-lg mt-1 tracking-[0.04em]">Look up a stored receipt</h3>
        <div className="dashed-rule my-4" />
        <div className="grid sm:grid-cols-[1fr_auto] gap-3">
          <input
            className="field-input"
            placeholder="rct_xxxxxxxx"
            value={byId}
            onChange={(e) => setById(e.target.value)}
          />
          <button onClick={verifyById} className="command-button accent" disabled={busy}>
            {busy ? "Verifying…" : "Verify ID"}
          </button>
        </div>
      </div>

      <div className="ink-panel p-5">
        <div className="label">B · PASTE RECEIPT JSON</div>
        <h3 className="font-display text-paper text-lg mt-1 tracking-[0.04em]">Verify a third-party receipt</h3>
        <div className="dashed-rule my-4" />
        <textarea
          className="field-input min-h-[180px] font-tech text-[12px]"
          placeholder='{"id":"rct_…","agentId":"…", … }'
          value={json}
          onChange={(e) => setJson(e.target.value)}
        />
        <div className="mt-3 flex items-center gap-3">
          <button onClick={verifyJson} className="command-button accent" disabled={busy}>
            {busy ? "Verifying…" : "Verify JSON"}
          </button>
        </div>
      </div>

      {result && (
        <div className={`paper-panel p-5 ${result.valid ? "border-green" : "border-red"}`}>
          <div className="flex items-center justify-between">
            <span className="label">VERIFICATION RESULT</span>
            <span
              className={`font-tech text-[11px] uppercase tracking-[0.22em] ${
                result.valid ? "text-green" : "text-red"
              }`}
            >
              {result.valid ? "VALID" : "INVALID"}
            </span>
          </div>
          {!result.valid && result.reasons.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-paper text-sm">
              {result.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
          {result.valid && (
            <p className="mt-3 text-paperMuted text-sm">
              Signature and canonical receipt hash match the MandateSeal signing key. This receipt
              has not been tampered with.
            </p>
          )}
          {!!result.receipt && (
            <details className="mt-4">
              <summary className="cursor-pointer font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
                receipt payload
              </summary>
              <pre className="mt-2 font-tech text-[11px] text-paper whitespace-pre-wrap break-all">
                {JSON.stringify(result.receipt, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
