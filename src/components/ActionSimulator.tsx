"use client";
import { useState } from "react";

export interface SimAction {
  label: string;
  actionType: string;
  tool: string;
  costUsd: number;
  target: string;
  // v0.2 — optional crypto fields. Submitted with the action when present.
  chain?: string;
  token?: string;
  amount?: string;
  txValueUsd?: number;
  recipient?: string;
  contractAddress?: string;
  functionSelector?: string;
}

export const PRESET_ACTIONS: SimAction[] = [
  // --- v0.2 crypto presets (first so they're the default discovery) -------
  {
    label: "Transfer 25 USDC on Base",
    tool: "wallet",
    actionType: "transfer_usdc",
    costUsd: 0,
    target: "0x" + "ab".repeat(20),
    chain: "base",
    token: "USDC",
    amount: "25000000",
    txValueUsd: 25,
    recipient: "0x" + "ab".repeat(20),
  },
  {
    label: "Swap ETH → USDC",
    tool: "dex",
    actionType: "token_swap",
    costUsd: 0,
    target: "0x" + "11".repeat(20),
    chain: "base",
    token: "ETH",
    amount: "1000000000000000",
    txValueUsd: 3.5,
    contractAddress: "0x" + "11".repeat(20),
    functionSelector: "0x38ed1739",
  },
  {
    label: "Approve token spend",
    tool: "wallet",
    actionType: "token_approval",
    costUsd: 0,
    target: "0x" + "11".repeat(20),
    chain: "base",
    token: "USDC",
    amount: "1000000",
    contractAddress: "0x" + "11".repeat(20),
    functionSelector: "0x095ea7b3",
  },
  {
    label: "Call unknown contract",
    tool: "wallet",
    actionType: "contract_call",
    costUsd: 0,
    target: "0x" + "22".repeat(20),
    chain: "base",
    contractAddress: "0x" + "22".repeat(20),
    functionSelector: "0xdeadbeef",
  },
  {
    label: "Bridge funds (Base → Eth)",
    tool: "bridge",
    actionType: "bridge_transfer",
    costUsd: 0,
    target: "ethereum",
    chain: "base",
    token: "USDC",
    amount: "100000000",
    txValueUsd: 100,
  },
  {
    label: "DAO vote",
    tool: "governor",
    actionType: "dao_vote",
    costUsd: 0,
    target: "0x" + "33".repeat(20),
    chain: "base",
    contractAddress: "0x" + "33".repeat(20),
  },
  // --- legacy / non-crypto presets (kept for backwards compat) ------------
  {
    label: "Call paid API",
    tool: "paid_api_call",
    actionType: "paid_api_call",
    costUsd: 0.02,
    target: "https://api.openai.com/v1/responses",
  },
  {
    label: "Send email",
    tool: "email_draft",
    actionType: "send_email",
    costUsd: 0,
    target: "mail:user@example.com",
  },
  {
    label: "Run shell command",
    tool: "shell_exec",
    actionType: "execute_shell_command",
    costUsd: 0,
    target: "terminal",
  },
  {
    label: "Buy dataset",
    tool: "paid_api_call",
    actionType: "buy_dataset",
    costUsd: 3.5,
    target: "https://dataset.market/api",
  },
];

export function ActionSimulator({
  onRun,
  busy,
}: {
  onRun: (a: SimAction) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<SimAction>(PRESET_ACTIONS[0]);

  return (
    <div className="ink-panel p-5">
      <div className="label">SECTION 03</div>
      <h3 className="font-display text-paper text-xl tracking-[0.04em] mt-1">ACTION SIMULATOR</h3>

      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {PRESET_ACTIONS.map((a) => {
          const active = a.label === selected.label;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => setSelected(a)}
              className={`text-left border px-3 py-3 font-tech text-[11px] uppercase tracking-[0.12em] transition ${
                active
                  ? "border-paper bg-paper text-ink"
                  : "border-line text-paper hover:border-paper"
              }`}
            >
              <div className="text-[10px] text-paperMuted">{a.tool}</div>
              <div className="mt-1">{a.label}</div>
              <div className="mt-2 text-[10px] opacity-80 truncate">{a.target}</div>
              <div className="mt-1 text-[10px]">${a.costUsd.toFixed(2)}</div>
            </button>
          );
        })}
      </div>

      <div className="dashed-rule my-5" />
      <div className="flex flex-wrap items-center gap-3">
        <button className="command-button accent" onClick={() => onRun(selected)} disabled={busy}>
          {busy ? "Running…" : "Run Policy Check"}
        </button>
        <span className="font-tech text-[11px] uppercase tracking-[0.18em] text-paperMuted">
          selected: {selected.label}
        </span>
      </div>
    </div>
  );
}
