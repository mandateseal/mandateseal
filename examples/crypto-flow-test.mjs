// End-to-end crypto flow smoke test.
//   1. read existing wallet mandate via /api/mandates/:id (default Atlas-01)
//   2. POST /api/check with a transfer_usdc action → expect a signed receipt
//   3. POST /api/verify with the receipt id → expect { valid: true }
//
// Usage:
//   MANDATESEAL_URL=https://mandateseal.tech \
//   MANDATESEAL_API_KEY=msk_demo_... \
//   node examples/crypto-flow-test.mjs

const BASE = process.env.MANDATESEAL_URL ?? "https://mandateseal.tech";
const KEY = process.env.MANDATESEAL_API_KEY ?? "";
const AGENT = "agent_atlas_01";
const MANDATE = "mandate_research_budget_v1";

if (!KEY) {
  console.error("Missing MANDATESEAL_API_KEY");
  process.exit(1);
}

function ok(label) {
  console.log(`  \x1b[32m✓\x1b[0m ${label}`);
}
function fail(label, detail) {
  console.log(`  \x1b[31m✗ ${label}\x1b[0m  ${detail ?? ""}`);
  process.exitCode = 1;
}

async function main() {
  console.log(`\n[crypto flow test]   ${BASE}\n`);

  // --- 1. mandate exists + has crypto fields -----------------------------
  console.log("step 1 — wallet mandate exists");
  const mres = await fetch(`${BASE}/api/mandates/${MANDATE}`, {
    headers: { "Authorization": `Bearer ${KEY}` },
  });
  if (!mres.ok) return fail("GET /api/mandates/:id", `HTTP ${mres.status}`);
  const { mandate } = await mres.json();
  ok(`mandate ${mandate.id}`);
  ok(`allowedChains   ${JSON.stringify(mandate.allowedChains)}`);
  ok(`allowedTokens   ${JSON.stringify(mandate.allowedTokens)}`);
  ok(`maxTxValueUsd   $${mandate.maxTxValueUsd}`);
  ok(`requireApprovalForSwaps  ${mandate.requireApprovalForSwaps}`);
  if (!mandate.allowedChains.includes("base")) {
    return fail("mandate lacks base chain", JSON.stringify(mandate.allowedChains));
  }

  // --- 2. check transfer → receipt --------------------------------------
  console.log("\nstep 2 — POST /api/check (transfer 25 USDC on Base)");
  const recipient = "0x" + "ab".repeat(20);
  const action = {
    agentId: AGENT,
    actionType: "transfer_usdc",
    tool: "wallet",
    target: recipient,
    costUsd: 0,
    chain: "base",
    token: "USDC",
    amount: "25000000",
    txValueUsd: 25,
    recipient,
  };
  const cres = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(action),
  });
  if (!cres.ok) return fail("POST /api/check", `HTTP ${cres.status}`);
  const cdata = await cres.json();
  ok(`decision    ${cdata.decision}`);
  ok(`matched     ${cdata.matchedRule}`);
  if (!cdata.receipt) return fail("missing receipt in response");
  const r = cdata.receipt;
  ok(`receipt id  ${r.id}`);
  ok(`receiptHash ${r.receiptHash.slice(0, 16)}…`);

  // confirm crypto fields are on the persisted receipt
  if (r.chain !== "base") fail("receipt.chain", r.chain);
  else ok(`crypto.chain      ${r.chain}`);
  if (r.token !== "USDC") fail("receipt.token", r.token);
  else ok(`crypto.token     ${r.token}`);
  if (r.recipient !== recipient) fail("receipt.recipient", r.recipient);
  else ok(`crypto.recipient ${r.recipient.slice(0, 14)}…`);
  if (r.txValueUsd !== 25) fail("receipt.txValueUsd", r.txValueUsd);
  else ok(`crypto.txValueUsd $${r.txValueUsd}`);

  // --- 3. verify receipt by id ------------------------------------------
  console.log("\nstep 3 — POST /api/verify");
  const vres = await fetch(`${BASE}/api/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: r.id }),
  });
  if (!vres.ok) return fail("POST /api/verify", `HTTP ${vres.status}`);
  const vdata = await vres.json();
  if (vdata.valid) ok("signature + hash recompute → VALID");
  else fail("verify returned invalid", JSON.stringify(vdata.reasons));

  if (vdata.reEvaluation?.matched) ok("policy re-evaluation matched (decision reproducible)");
  else fail("policy re-evaluation drifted", JSON.stringify(vdata.reEvaluation));

  // --- 4. verify the same receipt by full payload (offline-style) -------
  console.log("\nstep 4 — verify by full receipt payload");
  const v2 = await fetch(`${BASE}/api/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(r),
  });
  const v2data = await v2.json();
  if (v2data.valid) ok("full-payload verify → VALID");
  else fail("full-payload verify failed", JSON.stringify(v2data.reasons));

  if (process.exitCode) console.log("\n\x1b[31m✗ flow test failed\x1b[0m");
  else console.log("\n\x1b[32m✓ crypto flow end-to-end OK\x1b[0m");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
