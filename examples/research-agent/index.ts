// MandateSeal example — an autonomous crypto agent that wraps every onchain
// action with `seal.guard()`. The "agent" is just a scripted task list; real
// agent frameworks (Eliza, AutoGen, the Anthropic tool-use API, LangChain,
// custom loops) plug in the same way — replace the scripted tasks with
// model-decided actions.
//
// Run:
//   MANDATESEAL_URL=https://mandateseal.vercel.app \
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

// --- mocked tx senders --------------------------------------------------------
// In real code these would call viem/ethers to actually sign + broadcast.
// They're mocked so the example runs offline and stays deterministic.

async function sendTransfer(_chain: string, _token: string, _amount: string, _to: string) {
  await new Promise((r) => setTimeout(r, 80));
  return "[mock] tx 0xdeadbeef… transfer ok";
}
async function sendSwap(_chain: string, _from: string, _to: string, _amount: string) {
  await new Promise((r) => setTimeout(r, 100));
  return "[mock] tx 0xfeedface… swap ok";
}
async function sendApprove(_chain: string, _token: string, _spender: string, _amount: string) {
  await new Promise((r) => setTimeout(r, 60));
  return "[mock] tx 0xa11ce… approve ok";
}
async function sendContractCall(_chain: string, _to: string, _selector: string) {
  return "[mock] tx 0xbeefbeef… call ok";
}

const RECIPIENT_OK = "0x" + "ab".repeat(20);
const RECIPIENT_BLOCKED = "0x" + "de".repeat(20);
const DEX = "0x" + "11".repeat(20);
const UNKNOWN_CONTRACT = "0x" + "22".repeat(20);

interface Task {
  label: string;
  run: () => Promise<unknown>;
}

const tasks: Task[] = [
  {
    label: "transfer 25 USDC on Base",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "transfer_usdc",
          tool: "wallet",
          target: RECIPIENT_OK,
          costUsd: 0,
          chain: "base",
          token: "USDC",
          amount: "25000000",
          txValueUsd: 25,
          recipient: RECIPIENT_OK,
        },
        () => sendTransfer("base", "USDC", "25000000", RECIPIENT_OK),
      ),
  },
  {
    label: "swap 0.001 ETH → USDC",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "token_swap",
          tool: "dex",
          target: DEX,
          costUsd: 0,
          chain: "base",
          token: "ETH",
          amount: "1000000000000000",
          txValueUsd: 3.5,
          contractAddress: DEX,
          functionSelector: "0x38ed1739",
        },
        () => sendSwap("base", "ETH", "USDC", "1000000000000000"),
        { approvalTimeoutMs: 15_000 },
      ),
  },
  {
    label: "approve $1 USDC to DEX (finite)",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "token_approval",
          tool: "wallet",
          target: DEX,
          costUsd: 0,
          chain: "base",
          token: "USDC",
          amount: "1000000",
          contractAddress: DEX,
          functionSelector: "0x095ea7b3",
        },
        () => sendApprove("base", "USDC", DEX, "1000000"),
      ),
  },
  {
    label: "call unknown contract",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "contract_call",
          tool: "wallet",
          target: UNKNOWN_CONTRACT,
          costUsd: 0,
          chain: "base",
          contractAddress: UNKNOWN_CONTRACT,
          functionSelector: "0xdeadbeef",
        },
        () => sendContractCall("base", UNKNOWN_CONTRACT, "0xdeadbeef"),
        { approvalTimeoutMs: 15_000 },
      ),
  },
  {
    label: "transfer 250 USDC to a blocked recipient",
    run: () =>
      seal.guard(
        {
          agentId: AGENT_ID,
          actionType: "transfer_usdc",
          tool: "wallet",
          target: RECIPIENT_BLOCKED,
          costUsd: 0,
          chain: "base",
          token: "USDC",
          amount: "250000000",
          txValueUsd: 250,
          recipient: RECIPIENT_BLOCKED,
        },
        () => sendTransfer("base", "USDC", "250000000", RECIPIENT_BLOCKED),
      ),
  },
];

async function main() {
  console.log("MandateSeal research-agent (crypto) example");
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
