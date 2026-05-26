"use client";
import { useCallback, useState } from "react";
import { AgentProfile, type AgentDTO } from "./AgentProfile";
import { MandateBuilder, type MandateData } from "./MandateBuilder";
import { ActionSimulator, type SimAction } from "./ActionSimulator";
import { DecisionCard } from "./DecisionCard";
import { ReceiptCard } from "./ReceiptCard";
import { ReceiptTable } from "./ReceiptTable";
import type { ReceiptView } from "@/lib/serialize";

interface Bootstrap {
  agent: AgentDTO | null;
  mandate: MandateData | null;
  freshApiKey: string | null;
  receipts: ReceiptView[];
}

export function DashboardClient({ initial }: { initial: Bootstrap }) {
  const [agent, setAgent] = useState<AgentDTO | null>(initial.agent);
  const [mandate, setMandate] = useState<MandateData | null>(initial.mandate);
  const [freshApiKey, setFreshApiKey] = useState<string | null>(initial.freshApiKey);
  const [receipts, setReceipts] = useState<ReceiptView[]>(initial.receipts);
  const [lastDecision, setLastDecision] = useState<{
    decision: ReceiptView["decision"];
    reason: string;
    matchedRule: string;
    riskLevel: ReceiptView["riskLevel"];
    timestamp: string;
  } | null>(null);
  const [lastReceipt, setLastReceipt] = useState<ReceiptView | null>(null);
  const [running, setRunning] = useState(false);

  const refreshReceipts = useCallback(async () => {
    if (!agent) return;
    const res = await fetch(`/api/receipts?agentId=${agent.id}`, { cache: "no-store" });
    const data = await res.json();
    setReceipts(data.receipts ?? []);
  }, [agent]);

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
    setAgent(data.agent);
    setFreshApiKey(data.apiKey);
    // Create a default mandate stub for the new agent.
    const mres = await fetch("/api/mandates", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: data.agent.id,
        name: `${data.agent.name}-mandate-v1`,
        dailyBudgetUsd: 25,
        maxCostPerActionUsd: 2,
        approvalThresholdUsd: 5,
        allowedTools: [],
        blockedTools: [],
        blockedActions: [],
        approvalRequiredActions: [],
        allowedDomains: [],
        blockedDomains: [],
      }),
    });
    const mdata = await mres.json();
    if (mres.ok) setMandate(mdata.mandate);
    setReceipts([]);
    setLastDecision(null);
    setLastReceipt(null);
  }

  async function runPolicyCheck(action: SimAction) {
    if (!agent || !mandate) {
      alert("Need an agent + mandate first.");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: agent.id,
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

      <AgentProfile agent={agent} freshApiKey={freshApiKey} onCreate={createAgent} />

      {mandate && (
        <MandateBuilder
          mandate={mandate}
          onSaved={(next) => {
            setMandate(next);
          }}
        />
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
