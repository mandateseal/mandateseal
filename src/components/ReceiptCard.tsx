"use client";
import { useState } from "react";
import { StampBadge } from "./StampBadge";
import { HashText } from "./HashText";
import type { ReceiptView } from "@/lib/serialize";
import { fmtTimestamp } from "@/lib/fmt";

export function ReceiptCard({ receipt }: { receipt: ReceiptView }) {
  const [verifyState, setVerifyState] = useState<null | { valid: boolean; reasons: string[] }>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function verify() {
    setBusy(true);
    setVerifyState(null);
    try {
      const payload = receipt.rawPayload ? receipt : { id: receipt.id };
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setVerifyState({ valid: !!data.valid, reasons: data.reasons ?? [] });
    } catch (e) {
      setVerifyState({ valid: false, reasons: [(e as Error).message] });
    } finally {
      setBusy(false);
    }
  }

  async function copy(kind: "json" | "share" | "link") {
    const text =
      kind === "json"
        ? JSON.stringify(receipt, null, 2)
        : kind === "share"
        ? shareText(receipt)
        : `${window.location.origin}/r/${receipt.id}`;
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="receipt-paper px-6 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="label">SECTION 05</div>
          <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">SIGNED RECEIPT</h3>
        </div>
        <StampBadge status={receipt.decision} />
      </div>
      <div className="dashed-rule my-4" />
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 font-tech text-[12px] text-paper">
        <Cell k="receipt id" v={receipt.id} />
        <Cell k="timestamp" v={fmtTimestamp(receipt.timestamp)} />
        <Cell k="agent id" v={receipt.agentId} />
        <Cell k="mandate id" v={receipt.mandateId} />
        <Cell k="action" v={receipt.actionType} />
        <Cell k="tool" v={receipt.tool} />
        <Cell k="target" v={receipt.target} />
        <Cell k="cost (usd)" v={`$${receipt.costUsd.toFixed(2)}`} />
        <Cell k="risk" v={receipt.riskLevel} />
        <Cell k="decision" v={receipt.decision} />
      </div>

      <div className="dashed-rule my-5" />
      <div className="space-y-3">
        <HashText label="policyHash" value={receipt.policyHash} />
        <HashText label="receiptHash" value={receipt.receiptHash} />
        <HashText label="signature (Ed25519, base64)" value={receipt.signature} />
      </div>

      <div className="dashed-rule my-5" />
      <div className="flex flex-wrap items-center gap-2">
        <button className="command-button accent" onClick={verify} disabled={busy}>
          {busy ? "Verifying…" : "Verify"}
        </button>
        <button className="command-button" onClick={() => copy("link")}>
          {copied === "link" ? "Copied" : "Copy public link"}
        </button>
        <a
          href={`/r/${receipt.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="command-button"
        >
          Open public page
        </a>
        <button className="command-button" onClick={() => copy("json")}>
          {copied === "json" ? "Copied" : "Copy JSON"}
        </button>
        <button className="command-button" onClick={() => copy("share")}>
          {copied === "share" ? "Copied" : "Share Text"}
        </button>
        {verifyState && (
          <span
            className={`font-tech text-[11px] uppercase tracking-[0.18em] ${
              verifyState.valid ? "text-green" : "text-red"
            }`}
          >
            {verifyState.valid
              ? "verified ✓"
              : `invalid · ${verifyState.reasons.join("; ") || "signature mismatch"}`}
          </span>
        )}
      </div>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="label">{k}</div>
      <div className="truncate">{v}</div>
    </div>
  );
}

function shareText(r: ReceiptView): string {
  return [
    `MandateSeal Receipt ${r.id}`,
    `agent ${r.agentId} · mandate ${r.mandateId}`,
    `${r.decision} · ${r.actionType} · ${r.tool} → ${r.target}`,
    `cost $${r.costUsd.toFixed(2)} · risk ${r.riskLevel}`,
    `policyHash ${r.policyHash}`,
    `receiptHash ${r.receiptHash}`,
    `signature ${r.signature}`,
    `timestamp ${r.timestamp}`,
  ].join("\n");
}
