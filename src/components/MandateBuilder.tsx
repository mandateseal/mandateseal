"use client";
import { useEffect, useState } from "react";
import { TagListEditor } from "./TagListEditor";

export interface MandateData {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  dailyBudgetUsd: number;
  maxCostPerActionUsd: number;
  approvalThresholdUsd: number;
  allowedTools: string[];
  blockedTools: string[];
  blockedActions: string[];
  approvalRequiredActions: string[];
  allowedDomains: string[];
  blockedDomains: string[];
  // v0.2 — wallet mandate fields.
  agentWallet: string | null;
  ownerWallet: string | null;
  allowedChains: string[];
  allowedTokens: string[];
  allowedContracts: string[];
  blockedContracts: string[];
  blockedRecipients: string[];
  maxTxValueUsd: number;
  dailyTokenSpendUsd: number;
  requireApprovalForSwaps: boolean;
  requireApprovalForTransfers: boolean;
  // v0.4 — operator-controlled public exposure on /r/:id.
  publicFields: string[] | null;
}

export function MandateBuilder({
  mandate,
  onSaved,
}: {
  mandate: MandateData;
  onSaved: (next: MandateData) => void;
}) {
  const [draft, setDraft] = useState<MandateData>(mandate);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft(mandate);
  }, [mandate.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function update<K extends keyof MandateData>(k: K, v: MandateData[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/mandates/${draft.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          enabled: draft.enabled,
          dailyBudgetUsd: draft.dailyBudgetUsd,
          maxCostPerActionUsd: draft.maxCostPerActionUsd,
          approvalThresholdUsd: draft.approvalThresholdUsd,
          allowedTools: draft.allowedTools,
          blockedTools: draft.blockedTools,
          blockedActions: draft.blockedActions,
          approvalRequiredActions: draft.approvalRequiredActions,
          allowedDomains: draft.allowedDomains,
          blockedDomains: draft.blockedDomains,
          // v0.2 — wallet mandate. Empty strings become null on the server side.
          agentWallet: draft.agentWallet?.trim() || null,
          ownerWallet: draft.ownerWallet?.trim() || null,
          allowedChains: draft.allowedChains,
          allowedTokens: draft.allowedTokens,
          allowedContracts: draft.allowedContracts,
          blockedContracts: draft.blockedContracts,
          blockedRecipients: draft.blockedRecipients,
          maxTxValueUsd: draft.maxTxValueUsd,
          dailyTokenSpendUsd: draft.dailyTokenSpendUsd,
          requireApprovalForSwaps: draft.requireApprovalForSwaps,
          requireApprovalForTransfers: draft.requireApprovalForTransfers,
          publicFields: draft.publicFields,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("ERROR: " + (data.error ?? res.statusText));
      } else {
        setStatus("Mandate saved.");
        onSaved(data.mandate);
      }
    } catch (e) {
      setStatus("ERROR: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ink-panel p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <div className="label">SECTION 02</div>
          <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">MANDATE BUILDER</h3>
        </div>
        <label className="flex items-center gap-2 font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => update("enabled", e.target.checked)}
          />
          enabled
        </label>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Field label="name">
          <input
            className="field-input"
            value={draft.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>
        <NumField
          label="daily budget (usd)"
          value={draft.dailyBudgetUsd}
          onChange={(v) => update("dailyBudgetUsd", v)}
        />
        <NumField
          label="max per action (usd)"
          value={draft.maxCostPerActionUsd}
          onChange={(v) => update("maxCostPerActionUsd", v)}
        />
        <NumField
          label="approval threshold (usd)"
          value={draft.approvalThresholdUsd}
          onChange={(v) => update("approvalThresholdUsd", v)}
        />
      </div>

      <div className="dashed-rule my-5" />

      <div className="grid md:grid-cols-2 gap-5">
        <TagListEditor
          label="allowed tools"
          tone="allow"
          values={draft.allowedTools}
          onChange={(v) => update("allowedTools", v)}
          placeholder="e.g. wallet, dex, paid_api_call"
        />
        <TagListEditor
          label="blocked tools"
          tone="block"
          values={draft.blockedTools}
          onChange={(v) => update("blockedTools", v)}
          placeholder="e.g. shell_exec"
        />
        <TagListEditor
          label="blocked actions"
          tone="block"
          values={draft.blockedActions}
          onChange={(v) => update("blockedActions", v)}
          placeholder="e.g. delete_files"
        />
        <TagListEditor
          label="approval required actions"
          values={draft.approvalRequiredActions}
          onChange={(v) => update("approvalRequiredActions", v)}
          placeholder="e.g. send_email"
        />
        <TagListEditor
          label="allowed domains"
          tone="allow"
          values={draft.allowedDomains}
          onChange={(v) => update("allowedDomains", v)}
          placeholder="e.g. api.openai.com"
        />
        <TagListEditor
          label="blocked domains"
          tone="block"
          values={draft.blockedDomains}
          onChange={(v) => update("blockedDomains", v)}
          placeholder="e.g. unknown-wallet.site"
        />
      </div>

      <div className="dashed-rule my-6" />
      <div className="flex items-center gap-2 mb-4">
        <span className="label">WALLET MANDATE</span>
        <span className="font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted">
          v0.2 · onchain agents
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="agent wallet (0x…)">
          <input
            className="field-input font-tech"
            placeholder="0x…"
            value={draft.agentWallet ?? ""}
            onChange={(e) => update("agentWallet", e.target.value)}
          />
        </Field>
        <Field label="owner wallet (0x…)">
          <input
            className="field-input font-tech"
            placeholder="0x…"
            value={draft.ownerWallet ?? ""}
            onChange={(e) => update("ownerWallet", e.target.value)}
          />
        </Field>
        <NumField
          label="max tx value (usd)"
          value={draft.maxTxValueUsd}
          onChange={(v) => update("maxTxValueUsd", v)}
        />
        <NumField
          label="daily token spend (usd)"
          value={draft.dailyTokenSpendUsd}
          onChange={(v) => update("dailyTokenSpendUsd", v)}
        />
      </div>

      <div className="mt-5 grid md:grid-cols-2 gap-5">
        <TagListEditor
          label="allowed chains"
          tone="allow"
          values={draft.allowedChains}
          onChange={(v) => update("allowedChains", v)}
          placeholder="e.g. base, base-sepolia"
        />
        <TagListEditor
          label="allowed tokens"
          tone="allow"
          values={draft.allowedTokens}
          onChange={(v) => update("allowedTokens", v)}
          placeholder="e.g. USDC, ETH"
        />
        <TagListEditor
          label="allowed contracts"
          tone="allow"
          values={draft.allowedContracts}
          onChange={(v) => update("allowedContracts", v)}
          placeholder="0x… DEX, governor, etc."
        />
        <TagListEditor
          label="blocked contracts"
          tone="block"
          values={draft.blockedContracts}
          onChange={(v) => update("blockedContracts", v)}
          placeholder="0x… known-bad contracts"
        />
        <TagListEditor
          label="blocked recipients"
          tone="block"
          values={draft.blockedRecipients}
          onChange={(v) => update("blockedRecipients", v)}
          placeholder="0x… sanctioned / phished addrs"
        />
      </div>

      <div className="mt-5 grid sm:grid-cols-2 gap-4">
        <label className="flex items-center gap-2 font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
          <input
            type="checkbox"
            checked={draft.requireApprovalForSwaps}
            onChange={(e) => update("requireApprovalForSwaps", e.target.checked)}
          />
          require approval for swaps
        </label>
        <label className="flex items-center gap-2 font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
          <input
            type="checkbox"
            checked={draft.requireApprovalForTransfers}
            onChange={(e) => update("requireApprovalForTransfers", e.target.checked)}
          />
          require approval for transfers
        </label>
      </div>

      <div className="dashed-rule my-6" />
      <div className="flex items-center gap-2 mb-3">
        <span className="label">PUBLIC EXPOSURE</span>
        <span className="font-tech text-[10px] uppercase tracking-[0.22em] text-paperMuted">
          v0.4 · per-mandate redaction policy
        </span>
      </div>
      <p className="text-[12px] text-paperMuted max-w-2xl mb-3">
        Empty = default safe redaction (most fields visible on <code>/r/:id</code>, rawPayload hidden).
        Add field names to override. Proof-grade fields (id, hashes, signature, decision, timestamp)
        are always public — they're what makes the receipt verifiable.
      </p>
      <TagListEditor
        label="public fields on /r/:id"
        tone="allow"
        values={draft.publicFields ?? []}
        onChange={(v) => update("publicFields", v.length === 0 ? null : v)}
        placeholder="actionType, tool, chain, token, recipient, txValueUsd, …"
      />

      <div className="dashed-rule my-5" />
      <div className="flex items-center gap-3">
        <button className="command-button accent" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save Mandate"}
        </button>
        {status && (
          <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
            {status}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={0}
        step="0.01"
        className="field-input"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  );
}
