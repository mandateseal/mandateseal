"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtTimestamp } from "@/lib/fmt";

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

export function AgentRow({ agent }: { agent: Agent }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"rotate" | "delete" | null>(null);
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function rotate() {
    if (!confirm(`Rotate API key for "${agent.name}"? The current key stops working immediately.`)) return;
    setBusy("rotate");
    try {
      const res = await fetch(`/api/agents/${agent.id}/rotate-key`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert("Failed: " + (data.error ?? res.statusText));
        return;
      }
      setFreshKey(data.apiKey);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!confirm(`Delete agent "${agent.name}"? This cascades to its mandates and receipts. Cannot be undone.`)) return;
    setBusy("delete");
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: "DELETE" });
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

  async function copyKey() {
    if (!freshKey) return;
    await navigator.clipboard.writeText(freshKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <tr className="border-t border-line text-paper">
        <td className="px-4 py-3">{agent.name}</td>
        <td className="px-4 py-3">{agent.role}</td>
        <td className="px-4 py-3"><code className="text-paperMuted">{agent.id}</code></td>
        <td className="px-4 py-3 text-green">● {agent.status}</td>
        <td className="px-4 py-3 text-paperMuted whitespace-nowrap">{fmtTimestamp(agent.createdAt)}</td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex gap-2">
            <button className="command-button" onClick={rotate} disabled={busy !== null}>
              {busy === "rotate" ? "…" : "Rotate Key"}
            </button>
            <button className="command-button" onClick={remove} disabled={busy !== null}>
              {busy === "delete" ? "…" : "Delete"}
            </button>
          </div>
        </td>
      </tr>
      {freshKey && (
        <tr className="border-t border-line">
          <td colSpan={6} className="px-4 py-4 bg-paper/[0.03]">
            <div className="label text-amber">⚠ NEW API KEY · SHOWN ONCE</div>
            <code className="font-tech text-[12px] text-paper break-all block mt-2">{freshKey}</code>
            <button onClick={copyKey} className="command-button accent mt-3">
              {copied ? "Copied" : "Copy"}
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
