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
  agents,
  activeAgentId,
  freshApiKey,
  baseUrl,
  onSwitch,
  onCreate,
  onRotateKey,
}: {
  agents: AgentDTO[];
  activeAgentId: string | null;
  freshApiKey: string | null;
  baseUrl: string;
  onSwitch: (id: string) => void;
  onCreate: (name: string, role: string) => Promise<void>;
  onRotateKey: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState<"create" | "rotate" | null>(null);
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);

  const agent = agents.find((a) => a.id === activeAgentId) ?? null;

  async function copy(kind: "key" | "curl", text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !role.trim()) return;
    setBusy("create");
    try {
      await onCreate(name.trim(), role.trim());
      setName("");
      setRole("");
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    if (!agent) return;
    if (!confirm(`Rotate API key for "${agent.name}"? The previous key will stop working immediately.`)) return;
    setBusy("rotate");
    try {
      await onRotateKey(agent.id);
    } finally {
      setBusy(null);
    }
  }

  const curlSnippet = agent && freshApiKey
    ? `curl -X POST ${baseUrl}/api/check \\
  -H "Authorization: Bearer ${freshApiKey}" \\
  -H "content-type: application/json" \\
  -d '{
    "agentId": "${agent.id}",
    "actionType": "paid_api_call",
    "tool": "paid_api_call",
    "target": "https://api.openai.com/v1/responses",
    "costUsd": 0.02
  }'`
    : "";

  return (
    <div className="ink-panel p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
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

      {agents.length > 1 && (
        <div className="mt-4">
          <div className="field-label">switch active agent</div>
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => {
              const active = a.id === activeAgentId;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSwitch(a.id)}
                  className={`border px-3 py-2 font-tech text-[11px] uppercase tracking-[0.14em] transition ${
                    active
                      ? "border-paper bg-paper text-ink"
                      : "border-line text-paper hover:border-paper"
                  }`}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <button onClick={() => copy("key", freshApiKey)} className="command-button accent">
              {copied === "key" ? "Copied" : "Copy API Key"}
            </button>
            <button onClick={() => copy("curl", curlSnippet)} className="command-button">
              {copied === "curl" ? "Copied" : "Copy curl test"}
            </button>
            <span className="font-tech text-[10px] uppercase tracking-[0.18em] text-paperMuted">
              we hash & discard the raw key. save it now.
            </span>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer font-tech text-[10px] uppercase tracking-[0.18em] text-paperMuted">
              show curl snippet
            </summary>
            <pre className="mt-2 ink-panel p-3 font-tech text-[11px] text-paper overflow-x-auto whitespace-pre">
{curlSnippet}
            </pre>
          </details>
        </div>
      )}

      {agent && !freshApiKey && (
        <div className="mt-3">
          <button
            onClick={rotate}
            disabled={busy === "rotate"}
            className="command-button"
            title="Generate a new API key and invalidate the previous one"
          >
            {busy === "rotate" ? "Rotating…" : "Rotate API Key"}
          </button>
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
        <button type="submit" disabled={busy === "create"} className="command-button">
          {busy === "create" ? "Creating…" : "Create Agent"}
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
