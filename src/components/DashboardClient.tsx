"use client";
import { useCallback, useState } from "react";
import { AgentProfile, type AgentDTO } from "./AgentProfile";
import { MandateBuilder, type MandateData } from "./MandateBuilder";
import { ActionSimulator, type SimAction } from "./ActionSimulator";
import { DecisionCard } from "./DecisionCard";
import { ReceiptCard } from "./ReceiptCard";
import { ReceiptTable } from "./ReceiptTable";
import Link from "next/link";
import type { ReceiptView } from "@/lib/serialize";

interface ApprovalRef {
  id: string;
  status: "pending" | "approved" | "denied" | "expired";
}

interface Bootstrap {
  agents: AgentDTO[];
  activeAgentId: string | null;
  mandate: MandateData | null;
  receipts: ReceiptView[];
}

export function DashboardClient({ initial, baseUrl }: { initial: Bootstrap; baseUrl: string }) {
  const [agents, setAgents] = useState<AgentDTO[]>(initial.agents);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(initial.activeAgentId);
  const [mandate, setMandate] = useState<MandateData | null>(initial.mandate);
  const [freshApiKey, setFreshApiKey] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<ReceiptView[]>(initial.receipts);
  const [lastDecision, setLastDecision] = useState<{
    decision: ReceiptView["decision"];
    reason: string;
    matchedRule: string;
    riskLevel: ReceiptView["riskLevel"];
    timestamp: string;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptView | null>(null);
  const [lastApproval, setLastApproval] = useState<ApprovalRef | null>(null);
  const [running, setRunning] = useState(false);

  const refreshReceipts = useCallback(async () => {
    if (!activeAgentId) return;
    const res = await fetch(`/api/receipts?agentId=${activeAgentId}`, { cache: "no-store" });
    const data = await res.json();
    setReceipts(data.receipts ?? []);
  }, [activeAgentId]);

  async function loadAgent(id: string) {
    setActiveAgentId(id);
    setFreshApiKey(null);
    setLastDecision(null);
    setLastReceipt(null);
    setMandate(null);
    setReceipts([]);
    const [mRes, rRes] = await Promise.all([
      fetch(`/api/mandates?agentId=${id}`, { cache: "no-store" }),
      fetch(`/api/receipts?agentId=${id}`, { cache: "no-store" }),
    ]);
    const mData = await mRes.json();
    const rData = await rRes.json();
    setMandate(mData.mandates?.[0] ?? null);
    setReceipts(rData.receipts ?? []);
  }

  async function createAgent(name: string, role: string) {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, role }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert("Failed to create agent: " + (data.error ?? res.statusText));
      return;
    }
    // Server now creates a default mandate alongside the agent.
    setAgents((prev) => [data.agent, ...prev]);
    setActiveAgentId(data.agent.id);
    setMandate(data.mandate);
    setReceipts([]);
    setLastDecision(null);
    setLastReceipt(null);
    setFreshApiKey(data.apiKey);
  }

  async function rotateKey(id: string) {
    const res = await fetch(`/api/agents/${id}/rotate-key`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      alert("Failed to rotate key: " + (data.error ?? res.statusText));
      return;
    }
    setFreshApiKey(data.apiKey);
  }

  async function runPolicyCheck(action: SimAction) {
    if (!activeAgentId || !mandate) {
      alert("Need an agent + mandate first.");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgentId,
          mandateId: mandate.id,
          actionType: action.actionType,
          tool: action.tool,
          target: action.target,
          costUsd: action.costUsd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed");
        return;
      }
      const r: ReceiptView = data.receipt;
      setLastReceipt(r);
      setLastDecision({
        decision: r.decision,
        reason: r.reason,
        matchedRule: r.matchedRule,
        riskLevel: r.riskLevel,
        timestamp: r.timestamp,
      });
      setLastApproval(data.receipt?.approval ?? null);
      setReceipts((prev) => [r, ...prev]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page-container py-10 space-y-6">
      <header>
        <div className="label">CONTROL CONSOLE</div>
        <h1 className="display-title text-paper text-3xl md:text-4xl mt-2">
          MANDATESEAL · DASHBOARD
        </h1>
        <p className="mt-2 text-paperMuted text-sm">
          Approve before. Prove after. Configure a mandate, then run actions through the policy engine.
        </p>
      </header>

      <AgentProfile
        agents={agents}
        activeAgentId={activeAgentId}
        freshApiKey={freshApiKey}
        baseUrl={baseUrl}
        onSwitch={loadAgent}
        onCreate={createAgent}
        onRotateKey={rotateKey}
      />

      {mandate ? (
        <MandateBuilder mandate={mandate} onSaved={(next) => setMandate(next)} />
      ) : (
        activeAgentId && (
          <div className="paper-panel p-6 text-center font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
            no mandate found for this agent. create one via POST /api/mandates.
          </div>
        )
      )}

      <ActionSimulator onRun={runPolicyCheck} busy={running} />

      {lastDecision && (
        <DecisionCard
          decision={lastDecision.decision}
          reason={lastDecision.reason}
          matchedRule={lastDecision.matchedRule}
          riskLevel={lastDecision.riskLevel}
          timestamp={lastDecision.timestamp}
        />
      )}

      {lastApproval && (
        <div className="paper-panel p-5 border-l-4 border-amber">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="label text-amber">APPROVAL REQUIRED</div>
              <p className="mt-2 text-paper text-sm">
                A reviewer must approve or deny this action before the agent can proceed.
              </p>
              <code className="mt-2 inline-block font-tech text-[11px] text-paperMuted">
                approval id: {lastApproval.id}
              </code>
            </div>
            <Link href="/approvals" className="command-button accent">Open Queue</Link>
          </div>
        </div>
      )}

      {lastReceipt && <ReceiptCard receipt={lastReceipt} />}

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="label">SECTION 06</div>
            <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">RECEIPT ARCHIVE</h3>
          </div>
          <button className="command-button" onClick={refreshReceipts}>Refresh</button>
        </div>
        <ReceiptTable rows={receipts} />
      </div>
    </div>
  );
}
