"use client";
import { useState } from "react";

export interface AgentDTO {
  id: string;
  name: string;
  role: string;
  status: string;
  createdAt: string;
}

export function AgentProfile({
  agent,
  freshApiKey,
  onCreate,
}: {
  agent: AgentDTO | null;
  freshApiKey: string | null;
  onCreate: (name: string, role: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyKey() {
    if (!freshApiKey) return;
    await navigator.clipboard.writeText(freshApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    setBusy(true);
    try {
      await onCreate(name.trim(), role.trim());
      setName("");
      setRole("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ink-panel p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">SECTION 01</div>
          <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">AGENT PROFILE</h3>
        </div>
        {agent && (
          <span className="font-tech text-[10px] uppercase tracking-[0.2em] text-green">
            ● {agent.status}
          </span>
        )}
      </div>

      {agent && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Cell k="name" v={agent.name} />
          <Cell k="role" v={agent.role} />
          <Cell k="agent id" v={agent.id} mono />
        </div>
      )}

      {freshApiKey && (
        <div className="mt-4 paper-panel p-4">
          <div className="label text-amber">⚠ API KEY · SHOWN ONCE</div>
          <code className="font-tech text-[12px] text-paper break-all block mt-2">{freshApiKey}</code>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={copyKey} className="command-button accent">
              {copied ? "Copied" : "Copy API Key"}
            </button>
            <span className="font-tech text-[10px] uppercase tracking-[0.18em] text-paperMuted">
              we hash & discard the raw key. you must save it now.
            </span>
          </div>
        </div>
      )}

      <div className="dashed-rule my-5" />
      <form onSubmit={submit} className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
        <label>
          <span className="field-label">create new agent — name</span>
          <input
            className="field-input"
            placeholder="Atlas-02"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          <span className="field-label">role</span>
          <input
            className="field-input"
            placeholder="Autonomous research agent"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy} className="command-button">
          {busy ? "Creating…" : "Create Agent"}
        </button>
      </form>
    </div>
  );
}

function Cell({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{k}</div>
      <div className={mono ? "font-tech text-[12px] text-paper break-all" : "text-paper text-sm"}>{v}</div>
    </div>
  );
}
