"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ToolView } from "@/lib/tool";
import { fmtTimestamp } from "@/lib/fmt";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

export function ToolsClient({ initial }: { initial: ToolView[] }) {
  const router = useRouter();
  const [tools, setTools] = useState<ToolView[]>(initial);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("POST");
  const [costUsd, setCostUsd] = useState("0");
  const [quotaPerDay, setQuotaPerDay] = useState("");
  const [inputSchema, setInputSchema] = useState("");
  const [busy, setBusy] = useState<"create" | string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const quota = quotaPerDay.trim() === "" ? null : Number(quotaPerDay);
      const schema = inputSchema.trim() === "" ? null : inputSchema.trim();
      const res = await fetch("/api/tools", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          endpoint: endpoint.trim(),
          description: description.trim(),
          method,
          defaultCostUsd: Number(costUsd) || 0,
          ...(quota !== null && Number.isFinite(quota) && quota > 0 ? { quotaPerDay: quota } : {}),
          ...(schema !== null ? { inputSchema: schema } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setTools((prev) => [...prev, data.tool]);
      setName("");
      setEndpoint("");
      setDescription("");
      setCostUsd("0");
      setQuotaPerDay("");
      setInputSchema("");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/tools/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setTools((prev) => prev.map((t) => (t.id === id ? data.tool : t)));
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(t: ToolView) {
    if (!confirm(`Delete tool "${t.name}"? Proxy calls to this name will 404 after deletion.`)) return;
    setBusy(t.id);
    try {
      const res = await fetch(`/api/tools/${t.id}`, { method: "DELETE" });
      if (res.ok) {
        setTools((prev) => prev.filter((x) => x.id !== t.id));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="ink-panel p-5">
        <div className="label">SECTION 01</div>
        <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">REGISTER TOOL</h3>
        <p className="mt-2 text-paperMuted text-sm">
          A tool is an upstream HTTP endpoint MandateSeal can proxy to. Agents call{" "}
          <code className="text-paper">POST /api/proxy/&lt;name&gt;</code> with a bearer key; we
          run the policy engine, seal a receipt, then forward the request.
        </p>
        <div className="dashed-rule my-4" />
        <form onSubmit={create} className="grid sm:grid-cols-2 gap-3">
          <label>
            <span className="field-label">name (slug)</span>
            <input className="field-input" placeholder="openai-responses" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            <span className="field-label">upstream endpoint</span>
            <input className="field-input" placeholder="https://api.openai.com/v1/responses" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} required />
          </label>
          <label>
            <span className="field-label">method</span>
            <select className="field-input" value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">default cost per call (usd)</span>
            <input type="number" min={0} step="0.01" className="field-input" value={costUsd} onChange={(e) => setCostUsd(e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">description (optional)</span>
            <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label>
            <span className="field-label">quota per day (optional)</span>
            <input
              type="number"
              min={1}
              step={1}
              className="field-input"
              placeholder="empty = unlimited"
              value={quotaPerDay}
              onChange={(e) => setQuotaPerDay(e.target.value)}
            />
          </label>
          <label>
            <span className="field-label">input schema · json (optional, mcp)</span>
            <input
              className="field-input font-tech"
              placeholder={`{"type":"object","properties":{...}}`}
              value={inputSchema}
              onChange={(e) => setInputSchema(e.target.value)}
            />
          </label>
          {error && (
            <div className="sm:col-span-2 font-tech text-[11px] uppercase tracking-[0.18em] text-red">{error}</div>
          )}
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy === "create"} className="command-button accent">
              {busy === "create" ? "Registering…" : "Register Tool"}
            </button>
          </div>
        </form>
      </section>

      <section className="ink-panel p-5">
        <div className="label">SECTION 02</div>
        <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">REGISTERED TOOLS · {tools.length}</h3>
        <div className="dashed-rule my-4" />
        {tools.length === 0 ? (
          <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
            no tools registered.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-tech text-[12px]">
              <thead>
                <tr className="text-left text-paperMuted">
                  <th className="px-3 py-2 label">NAME</th>
                  <th className="px-3 py-2 label">METHOD</th>
                  <th className="px-3 py-2 label">ENDPOINT</th>
                  <th className="px-3 py-2 label text-right">COST</th>
                  <th className="px-3 py-2 label text-right">QUOTA/DAY</th>
                  <th className="px-3 py-2 label">SCHEMA</th>
                  <th className="px-3 py-2 label">CREATED</th>
                  <th className="px-3 py-2 label">STATUS</th>
                  <th className="px-3 py-2 label">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {tools.map((t) => (
                  <tr key={t.id} className="border-t border-line text-paper align-top">
                    <td className="px-3 py-2">
                      <div className="font-tech">{t.name}</div>
                      {t.description && <div className="text-paperMuted text-[11px]">{t.description}</div>}
                    </td>
                    <td className="px-3 py-2">{t.method}</td>
                    <td className="px-3 py-2 truncate max-w-[280px]">{t.endpoint}</td>
                    <td className="px-3 py-2 text-right">${t.defaultCostUsd.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      {t.quotaPerDay ? t.quotaPerDay : <span className="text-paperMuted">∞</span>}
                    </td>
                    <td className="px-3 py-2">
                      {t.inputSchema ? (
                        <span className="text-amber text-[10px] uppercase tracking-[0.18em]">custom</span>
                      ) : (
                        <span className="text-paperMuted text-[10px] uppercase tracking-[0.18em]">default</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-paperMuted whitespace-nowrap">{fmtTimestamp(t.createdAt)}</td>
                    <td className={`px-3 py-2 ${t.enabled ? "text-green" : "text-paperMuted"}`}>● {t.enabled ? "enabled" : "disabled"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="command-button" onClick={() => toggle(t.id, !t.enabled)} disabled={busy === t.id}>
                          {t.enabled ? "Disable" : "Enable"}
                        </button>
                        <button className="command-button" onClick={() => remove(t)} disabled={busy === t.id}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="paper-panel p-5">
        <div className="label">HOW TO CALL</div>
        <p className="mt-2 text-paper text-sm">
          From an agent with a valid bearer key:
        </p>
        <pre className="mt-3 ink-panel p-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{`curl -X POST http://localhost:3000/api/proxy/<tool-name> \\
  -H "Authorization: Bearer msk_xxx" \\
  -H "content-type: application/json" \\
  -d '{ "your": "tool body" }'

# MandateSeal will:
#   1. Run the policy engine (matchedRule includes tool name)
#   2. Seal a receipt (returned via X-MandateSeal-Receipt header)
#   3. Forward the body to the upstream endpoint if APPROVED`}
        </pre>
      </section>
    </div>
  );
}
