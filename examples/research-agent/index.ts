// MandateSeal example — a "research agent" that wraps every tool call with
// `seal.guard()`. The "agent" itself is just a scripted sequence: real agent
// frameworks (LangChain, the Anthropic tool-use API, AutoGen, etc.) plug in
// the same way — replace the scripted task list with model-decided tool calls.
//
// Run:
//   MANDATESEAL_URL=https://mandateseal.vercel.app \
//   MANDATESEAL_API_KEY=msk_demo_... \
//   npx tsx examples/research-agent/index.ts
//
// Or against a local server:
//   MANDATESEAL_URL=http://localhost:3000 \
//   MANDATESEAL_API_KEY=msk_demo_... \
//   npx tsx examples/research-agent/index.ts

import { MandateSeal, MandateSealError } from "../../src/sdk/mandateseal";

const BASE = process.env.MANDATESEAL_URL ?? "http://localhost:3000";
const KEY = process.env.MANDATESEAL_API_KEY ?? "";
const AGENT_ID = process.env.MANDATESEAL_AGENT_ID ?? "agent_atlas_01";

if (!KEY) {
  console.error("Missing MANDATESEAL_API_KEY env var.");
  console.error("Get one by creating an agent in the dashboard, or use the seeded demo key.");
  process.exit(1);
}

const seal = new MandateSeal({ baseUrl: BASE, apiKey: KEY });

// --- mocked "tools" -----------------------------------------------------------
// In a real agent these would be real HTTP fetches / LLM tool calls / etc.
// They're mocked here so the example runs offline and stays deterministic.

async function webSearch(target: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 80));
  return `[mock] 3 results for "${target}"`;
}

async function paidApiCall(target: string, prompt: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 120));
  return `[mock] ${target} returned a summary of "${prompt}"`;
}

async function emailDraft(to: string, subject: string): Promise<string> {
  await new Promise((r) => setTimeout(r, 60));
  return `[mock] drafted email "${subject}" to ${to}`;
}

async function shellExec(_cmd: string): Promise<string> {
  // Never actually runs — MandateSeal blocks the tool before this resolves.
  return "[mock] shell output";
}

async function walletTransfer(_to: string, _amount: number): Promise<string> {
  // Never actually runs.
  return "[mock] tx 0xdead";
}

// --- agent script -------------------------------------------------------------

interface Task {
  label: string;
  run: () => Promise<unknown>;
}

const tasks: Task[] = [
  {
    label: "search github for autonomous-agent papers",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "search",
          tool: "web_search",
          target: "github.com",
          costUsd: 0.05,
        },
        () => webSearch("autonomous agents"),
      ),
  },
  {
    label: "summarize a paper via OpenAI",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "summarize",
          tool: "paid_api_call",
          target: "api.openai.com",
          costUsd: 1.2,
        },
        () => paidApiCall("api.openai.com", "summarize the abstract"),
      ),
  },
  {
    label: "draft an email to the author",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "send_email",
          tool: "email_draft",
          target: "author@example.com",
          costUsd: 0,
        },
        () => emailDraft("author@example.com", "follow-up on the paper"),
        // approval-required action — wait up to 15s before giving up
        { approvalTimeoutMs: 15_000 },
      ),
  },
  {
    label: "clean up cache via shell",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "execute_shell_command",
          tool: "shell_exec",
          target: "rm -rf /tmp/cache",
          costUsd: 0,
        },
        () => shellExec("rm -rf /tmp/cache"),
      ),
  },
  {
    label: "transfer 50 USDC to a wallet",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "transfer_usdc",
          tool: "wallet_transfer",
          target: "0xabc...def",
          costUsd: 50,
        },
        () => walletTransfer("0xabc...def", 50),
      ),
  },
];

// --- runner -------------------------------------------------------------------

async function main() {
  console.log(`MandateSeal research-agent example`);
  console.log(`  base   : ${BASE}`);
  console.log(`  agent  : ${AGENT_ID}`);
  console.log("");

  let approved = 0;
  let blocked = 0;
  let needsApproval = 0;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    process.stdout.write(`[${String(i + 1).padStart(2, "0")}] ${t.label} ... `);
    try {
      const out = await t.run();
      const { receipt } = out as { receipt: { id: string; receiptHash: string } };
      console.log(`✓ APPROVED  ${receipt.id}`);
      console.log(`     hash  ${receipt.receiptHash.slice(0, 16)}…`);
      approved++;
    } catch (err) {
      if (err instanceof MandateSealError) {
        const dec = (err.body as { decision?: string })?.decision ?? "BLOCKED";
        const rcpt = (err.body as { receipt?: { id: string; receiptHash: string } })?.receipt;
        if (dec === "NEEDS_APPROVAL") {
          console.log(`? NEEDS_APPROVAL (timed out or denied)`);
          needsApproval++;
        } else {
          console.log(`✗ ${dec}`);
          blocked++;
        }
        if (rcpt) console.log(`     hash  ${rcpt.receiptHash.slice(0, 16)}…`);
        console.log(`     reason ${err.message.replace(/^MandateSeal: /, "")}`);
      } else {
        console.log(`! error: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log("");
  console.log(`summary: ${approved} approved · ${blocked} blocked · ${needsApproval} needs-approval`);
  console.log("");
  console.log(`receipts persisted at: ${BASE}/receipts`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
