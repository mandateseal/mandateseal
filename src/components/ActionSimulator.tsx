"use client";
import { useState } from "react";

export interface SimAction {
  label: string;
  actionType: string;
  tool: string;
  costUsd: number;
  target: string;
}

export const PRESET_ACTIONS: SimAction[] = [
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
    label: "Transfer USDC",
    tool: "wallet_transfer",
    actionType: "transfer_usdc",
    costUsd: 12,
    target: "0x123456789",
  },
  {
    label: "Run shell command",
    tool: "shell_exec",
    actionType: "execute_shell_command",
    costUsd: 0,
    target: "terminal",
  },
  {
    label: "Read private file",
    tool: "file_reader",
    actionType: "read_private_file",
    costUsd: 0,
    target: "private-keys.local",
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
