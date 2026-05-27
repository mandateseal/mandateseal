"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtTimestamp } from "@/lib/fmt";
import type { WebhookView, DeliveryView, WebhookEvent } from "@/lib/webhook";

const ALL_EVENTS: WebhookEvent[] = [
  "receipt.created",
  "receipt.blocked",
  "receipt.needs_approval",
  "approval.requested",
  "approval.decided",
];

const statusTone: Record<string, string> = {
  sent: "text-green",
  pending: "text-amber",
  failed: "text-red",
};

export function WebhooksClient({
  initialWebhooks,
  initialDeliveries,
}: {
  initialWebhooks: WebhookView[];
  initialDeliveries: DeliveryView[];
}) {
  const router = useRouter();
  const [webhooks, setWebhooks] = useState<WebhookView[]>(initialWebhooks);
  const [deliveries, setDeliveries] = useState<DeliveryView[]>(initialDeliveries);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<WebhookEvent>>(new Set(["receipt.created"]));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function toggleEvent(e: WebhookEvent) {
    const next = new Set(events);
    next.has(e) ? next.delete(e) : next.add(e);
    setEvents(next);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    setError(null);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), url: url.trim(), events: [...events] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setWebhooks((prev) => [...prev, data.webhook]);
      setName("");
      setUrl("");
    } finally {
      setBusy(null);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (res.ok) setWebhooks((prev) => prev.map((w) => (w.id === id ? data.webhook : w)));
    } finally {
      setBusy(null);
    }
  }

  async function refreshDeliveries() {
    setRefreshing(true);
    try {
      // Fetch latest 50 across all webhooks by hitting each one. We could add
      // a global /api/webhook-deliveries endpoint later; for MVP the per-hook
      // route is what we have.
      const merged: DeliveryView[] = [];
      for (const w of webhooks) {
        const res = await fetch(`/api/webhooks/${w.id}/deliveries?limit=50`, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          merged.push(...(data.deliveries as DeliveryView[]));
        }
      }
      merged.sort((a, b) => (b.lastTriedAt ?? b.createdAt).localeCompare(a.lastTriedAt ?? a.createdAt));
      setDeliveries(merged.slice(0, 50));
    } finally {
      setRefreshing(false);
    }
  }

  async function remove(w: WebhookView) {
    if (!confirm(`Delete webhook "${w.name}"? Deliveries history will also be removed.`)) return;
    setBusy(w.id);
    try {
      const res = await fetch(`/api/webhooks/${w.id}`, { method: "DELETE" });
      if (res.ok) {
        setWebhooks((prev) => prev.filter((x) => x.id !== w.id));
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
        <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">REGISTER WEBHOOK</h3>
        <p className="mt-2 text-paperMuted text-sm">
          MandateSeal sends signed JSON to your URL when matching events fire. Verify the{" "}
          <code className="text-paper">X-MandateSeal-Signature</code> header against the public key.
          4 attempts with backoff (0 / 1 s / 5 s / 30 s).
        </p>
        <div className="dashed-rule my-4" />
        <form onSubmit={create} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <label>
              <span className="field-label">name</span>
              <input className="field-input" placeholder="ops-slack-channel" value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              <span className="field-label">url</span>
              <input type="url" className="field-input" placeholder="https://hooks.slack.com/services/..." value={url} onChange={(e) => setUrl(e.target.value)} required />
            </label>
          </div>
          <div>
            <div className="field-label">events</div>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map((e) => {
                const active = events.has(e);
                return (
                  <button
                    type="button"
                    key={e}
                    onClick={() => toggleEvent(e)}
                    className={`tag font-tech text-[11px] uppercase tracking-[0.12em] ${
                      active ? "bg-paper text-ink border-paper" : "text-paper hover:border-paper"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-red">{error}</div>}
          <button type="submit" disabled={busy === "create" || events.size === 0} className="command-button accent">
            {busy === "create" ? "Registering…" : "Register Webhook"}
          </button>
        </form>
      </section>

      <section className="ink-panel p-5">
        <div className="label">SECTION 02</div>
        <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">WEBHOOKS · {webhooks.length}</h3>
        <div className="dashed-rule my-4" />
        {webhooks.length === 0 ? (
          <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">no webhooks registered.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-tech text-[12px]">
              <thead>
                <tr className="text-left text-paperMuted">
                  <th className="px-3 py-2 label">NAME</th>
                  <th className="px-3 py-2 label">URL</th>
                  <th className="px-3 py-2 label">EVENTS</th>
                  <th className="px-3 py-2 label">STATUS</th>
                  <th className="px-3 py-2 label">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => (
                  <tr key={w.id} className="border-t border-line text-paper align-top">
                    <td className="px-3 py-2">{w.name}</td>
                    <td className="px-3 py-2 truncate max-w-[260px]">{w.url}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <span key={e} className="tag text-[10px] text-paperMuted">{e}</span>
                        ))}
                      </div>
                    </td>
                    <td className={`px-3 py-2 ${w.enabled ? "text-green" : "text-paperMuted"}`}>● {w.enabled ? "enabled" : "disabled"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="command-button" onClick={() => toggle(w.id, !w.enabled)} disabled={busy === w.id}>
                          {w.enabled ? "Disable" : "Enable"}
                        </button>
                        <button className="command-button" onClick={() => remove(w)} disabled={busy === w.id}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ink-panel p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="label">SECTION 03</div>
            <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">RECENT DELIVERIES · {deliveries.length}</h3>
          </div>
          <button onClick={refreshDeliveries} disabled={refreshing || webhooks.length === 0} className="command-button">
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
        <div className="dashed-rule my-4" />
        {deliveries.length === 0 ? (
          <div className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">no deliveries yet — events haven't fired.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-tech text-[12px]">
              <thead>
                <tr className="text-left text-paperMuted">
                  <th className="px-3 py-2 label">TIME</th>
                  <th className="px-3 py-2 label">EVENT</th>
                  <th className="px-3 py-2 label">STATUS</th>
                  <th className="px-3 py-2 label">ATTEMPTS</th>
                  <th className="px-3 py-2 label">RESP CODE</th>
                  <th className="px-3 py-2 label">ERROR</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d) => (
                  <tr key={d.id} className="border-t border-line text-paper">
                    <td className="px-3 py-2 whitespace-nowrap text-paperMuted">{fmtTimestamp(d.lastTriedAt ?? d.createdAt)}</td>
                    <td className="px-3 py-2">{d.eventType}</td>
                    <td className={`px-3 py-2 ${statusTone[d.status] ?? "text-paper"}`}>{d.status}</td>
                    <td className="px-3 py-2">{d.attempts}</td>
                    <td className="px-3 py-2">{d.responseCode ?? "—"}</td>
                    <td className="px-3 py-2 text-red truncate max-w-[280px]">{d.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="paper-panel p-5">
        <div className="label">VERIFY SIGNATURE</div>
        <p className="mt-2 text-paper text-sm">
          Each delivery sends headers including <code>X-MandateSeal-Signature</code> (Ed25519, base64).
          Recompute the signature on your side using the public key at <code>/api/key.pub</code>:
        </p>
        <pre className="mt-3 ink-panel p-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{`# Node example
import { verify, createPublicKey } from "node:crypto";
const ok = verify(
  null,
  Buffer.from(rawBody),
  createPublicKey(pubKeyPem),
  Buffer.from(req.headers["x-mandateseal-signature"], "base64"),
);`}
        </pre>
      </section>
    </div>
  );
}
