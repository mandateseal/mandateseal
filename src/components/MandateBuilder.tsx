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
          placeholder="e.g. paid_api_call"
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
