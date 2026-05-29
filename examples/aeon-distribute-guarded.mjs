// Aeon `distribute-tokens`, guarded by MandateSeal — LOCAL demo.
//
// Aeon's distribute-tokens skill pays a list of contributors by POSTing each
// transfer to the Bankr Wallet API. Its caps are all self-config: no external
// per-recipient ceiling, no chain/token allow-list enforced outside the agent,
// no human-approval gate. This script shows the same batch, but every transfer
// first passes through MandateSeal's "approve before" gate — only APPROVED rows
// reach Bankr (dry-run here; no funds move), and each decision is sealed.
//
// LOCAL ONLY. No external calls.
//   • Default: talks to a local MandateSeal dev server at http://localhost:3000.
//   • If that server isn't running, it FALLS BACK to an offline policy
//     simulation that mirrors the real engine's wallet rules (see policy.ts),
//     so the flow always runs with zero setup:
//
//       node examples/aeon-distribute-guarded.mjs
//
//   • To exercise the real signed-receipt path, start the app and pass a key:
//       npm run dev                       # in one terminal
//       MANDATESEAL_URL=http://localhost:3000 MANDATESEAL_API_KEY=msk_... \
//         node examples/aeon-distribute-guarded.mjs
//
// The Bankr leg is always a dry-run print — this demo never moves real money.

const BASE = process.env.MANDATESEAL_URL ?? "http://localhost:3000";
const KEY = process.env.MANDATESEAL_API_KEY ?? "";
const AGENT = process.env.MANDATESEAL_AGENT ?? "agent_atlas_01";
const MANDATE = process.env.MANDATESEAL_MANDATE ?? "mandate_research_budget_v1";

// ── tiny console helpers ────────────────────────────────────────────────────
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
const tag = (d) =>
  d === "APPROVED" ? `${C.g}APPROVED${C.x}`
  : d === "BLOCKED" ? `${C.r}BLOCKED ${C.x}`
  : `${C.y}NEEDS_APPROVAL${C.x}`;
const usd = (n) => `$${Number(n).toFixed(2)}`;

// ── the mandate (offline mode mirrors what an operator would set on-server) ──
// Mirrors the wallet fields the real policy engine reads (MandateSnapshot).
const PAYOUT_MANDATE = {
  name: "aeon-contributor-payouts",
  allowedChains: ["base"],
  allowedTokens: ["USDC", "ETH"],
  maxTxValueUsd: 200,
  blockedRecipients: ["0x000000000000000000000000000000000000dEaD"],
  requireApprovalForTransfers: false,
};

// ── the batch Aeon would hand to distribute-tokens (contributor-reward output)
const DEAD = "0x000000000000000000000000000000000000dEaD";
const BATCH = [
  { handle: "@alice", recipient: "0x1111111111111111111111111111111111111111", token: "USDC", chain: "base",     txValueUsd: 25  },
  { handle: "@bob",   recipient: "0x2222222222222222222222222222222222222222", token: "USDC", chain: "base",     txValueUsd: 80  },
  { handle: "@carol", recipient: "0x3333333333333333333333333333333333333333", token: "USDC", chain: "base",     txValueUsd: 250 }, // > maxTxValueUsd
  { handle: "@dave",  recipient: DEAD,                                          token: "USDC", chain: "base",     txValueUsd: 10  }, // blocked recipient
  { handle: "@erin",  recipient: "0x5555555555555555555555555555555555555555", token: "DAI",  chain: "base",     txValueUsd: 15  }, // token not allowed
  { handle: "@frank", recipient: "0x6666666666666666666666666666666666666666", token: "USDC", chain: "ethereum", txValueUsd: 40  }, // chain not allowed
];

// USDC has 6 decimals; this is illustrative base-unit math for the dry-run.
const baseUnits = (token, valueUsd) =>
  token === "USDC" ? String(Math.round(valueUsd * 1e6)) : String(valueUsd);

function actionFor(row) {
  return {
    agentId: AGENT,
    mandateId: MANDATE,
    actionType: "transfer_usdc",
    tool: "bankr",
    target: row.recipient,
    costUsd: 0,
    chain: row.chain,
    token: row.token,
    amount: baseUnits(row.token, row.txValueUsd),
    txValueUsd: row.txValueUsd,
    recipient: row.recipient,
  };
}

// ── offline policy mirror (faithful to src/lib/policy.ts wallet rules) ───────
const inList = (list, v) => list.some((x) => x.toLowerCase() === String(v).toLowerCase());
function evaluateOffline(action, m) {
  if (inList(m.blockedRecipients, action.recipient))
    return { decision: "BLOCKED", matchedRule: `blockedRecipients ∋ "${action.recipient}"`, reason: "Recipient is on the mandate's block list." };
  if (m.allowedChains.length && !inList(m.allowedChains, action.chain))
    return { decision: "BLOCKED", matchedRule: `allowedChains ∌ "${action.chain}"`, reason: `Chain "${action.chain}" is not in the allow list.` };
  if (m.allowedTokens.length && !inList(m.allowedTokens, action.token))
    return { decision: "BLOCKED", matchedRule: `allowedTokens ∌ "${action.token}"`, reason: `Token "${action.token}" is not in the allow list.` };
  if (m.maxTxValueUsd > 0 && action.txValueUsd > m.maxTxValueUsd)
    return { decision: "BLOCKED", matchedRule: "txValueUsd > maxTxValueUsd", reason: `Tx value ${usd(action.txValueUsd)} exceeds maxTxValueUsd ${usd(m.maxTxValueUsd)}.` };
  if ((action.actionType === "transfer_usdc" || action.actionType === "bridge_transfer") && m.requireApprovalForTransfers)
    return { decision: "NEEDS_APPROVAL", matchedRule: "requireApprovalForTransfers", reason: "Token transfer requires human approval." };
  return { decision: "APPROVED", matchedRule: "default.allow", reason: "Action satisfies the mandate." };
}

// ── live guard: POST /api/check with idempotency, return server decision ─────
async function checkLive(action, idemKey) {
  const res = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": `Bearer ${KEY}`,
      "Idempotency-Key": idemKey, // v0.8.1 — safe to retry the batch
    },
    body: JSON.stringify(action),
  });
  if (!res.ok) throw new Error(`/api/check → HTTP ${res.status}`);
  return res.json(); // { decision, matchedRule, reason, riskLevel, receipt }
}

async function verifyLive(receiptId) {
  const res = await fetch(`${BASE}/api/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: receiptId }),
  });
  return res.json(); // { valid, reasons, reEvaluation, receipt }
}

// ── Bankr leg — DRY RUN ONLY. Never POSTs to api.bankr.bot. ───────────────────
function bankrDryRun(action) {
  console.log(
    `      ${C.d}↳ would POST api.bankr.bot/wallet/transfer  ` +
    `{ to: ${action.recipient.slice(0, 10)}…, token: ${action.token}, amount: ${action.amount} }${C.x}`,
  );
}

async function probeServer() {
  if (!KEY) return false;
  try {
    const res = await fetch(`${BASE}/api/key.pub`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function runBatch({ live, mandate, runLabel }) {
  console.log(`\n${C.b}── ${runLabel} ──${C.x}`);
  let approved = 0, blocked = 0, queued = 0, movedUsd = 0;
  let sampleReceiptId = null;

  for (let i = 0; i < BATCH.length; i++) {
    const row = BATCH[i];
    const action = actionFor(row);

    let decision, matchedRule, receipt = null;
    if (live) {
      const out = await checkLive(action, `aeon-payout-${row.handle}-${i}`);
      ({ decision, matchedRule } = out);
      receipt = out.receipt;
      if (decision === "APPROVED" && !sampleReceiptId) sampleReceiptId = receipt?.id ?? null;
    } else {
      ({ decision, matchedRule } = evaluateOffline(action, mandate));
    }

    const recv = receipt ? ` ${C.d}rct ${receipt.id.slice(0, 12)}…${C.x}` : "";
    console.log(
      `  ${tag(decision)}  ${row.handle.padEnd(7)} ${usd(row.txValueUsd).padStart(8)} ` +
      `${row.token}/${row.chain.padEnd(8)} ${C.d}${matchedRule}${C.x}${recv}`,
    );

    if (decision === "APPROVED") { approved++; movedUsd += row.txValueUsd; bankrDryRun(action); }
    else if (decision === "BLOCKED") blocked++;
    else queued++;
  }

  console.log(
    `  ${C.b}→ ${approved} sent (${usd(movedUsd)}), ${blocked} blocked, ${queued} queued for human approval${C.x}`,
  );
  return sampleReceiptId;
}

async function main() {
  console.log(`\n${C.b}Aeon distribute-tokens × MandateSeal${C.x}  ${C.d}(${BASE})${C.x}`);

  const live = await probeServer();
  if (live) {
    console.log(`${C.g}● live${C.x} — real signed receipts from the local MandateSeal server`);
  } else {
    console.log(
      `${C.y}● offline${C.x} — local server not reachable / no key; using a faithful policy mirror` +
      `\n${C.d}  (start \`npm run dev\` and set MANDATESEAL_API_KEY for real signed receipts)${C.x}`,
    );
  }

  console.log(
    `\n${C.d}mandate: chains=${PAYOUT_MANDATE.allowedChains.join(",")}  ` +
    `tokens=${PAYOUT_MANDATE.allowedTokens.join(",")}  ` +
    `maxTx=${usd(PAYOUT_MANDATE.maxTxValueUsd)}  ` +
    `blocked=1 recipient${C.x}`,
  );

  // Run 1 — standard payout policy: small payouts auto-approve, violations blocked.
  const sampleId = await runBatch({ live, mandate: PAYOUT_MANDATE, runLabel: "Run 1 · standard payout mandate" });

  // Run 2 — strict policy: requireApprovalForTransfers routes EVERY payout to the
  // human queue. Faithful to rule C9 — the gate is mandate-level (all transfers).
  await runBatch({
    live: false, // offline so we can flip the flag without re-seeding the server
    mandate: { ...PAYOUT_MANDATE, requireApprovalForTransfers: true },
    runLabel: "Run 2 · strict mandate (requireApprovalForTransfers) — offline mirror",
  });

  // Prove-after: verify one sealed receipt (live mode only).
  if (live && sampleId) {
    console.log(`\n${C.b}── Prove after ──${C.x}`);
    const v = await verifyLive(sampleId);
    console.log(
      v.valid
        ? `  ${C.g}✓${C.x} receipt ${sampleId.slice(0, 12)}… → signature + hash VALID` +
          (v.reEvaluation?.matched ? `, policy reproducible` : "")
        : `  ${C.r}✗${C.x} verify failed: ${JSON.stringify(v.reasons)}`,
    );
  }

  console.log(
    `\n${C.d}Takeaway: distribute-tokens keeps its autonomy — MandateSeal just makes the ` +
    `money-moving path bounded (per-tx cap, chain/token allow-list, blocked recipients),\n` +
    `gated (human queue), and provable (signed receipt per decision).${C.x}\n`,
  );
}

main().catch((e) => { console.error(`\n${C.r}error:${C.x}`, e.message); process.exit(1); });
