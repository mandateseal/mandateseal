#!/usr/bin/env node
// MandateSeal CLI — quick verification, tail, and key generation.
// Usage: npx mandateseal <command> [args]

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { generateKeyPairSync, createPublicKey, createHash, verify as cryptoVerify } from "node:crypto";
import { argv, exit, env } from "node:process";

const BASE_URL = env.MANDATESEAL_BASE_URL || "http://localhost:3000";

function printHelp() {
  console.log(`MandateSeal CLI

Usage:
  mandateseal verify <receipt.json>       Verify a receipt against the running server
  mandateseal verify --offline <r.json> --pub <key.pem>
                                          Verify offline using a saved public key
  mandateseal tail [--agent <id>] [--limit 20] [--interval 2]
                                          Stream recent receipts (poll)
  mandateseal check <action.json> --key <apiKey>
                                          Run a preflight check
  mandateseal gen-keys                    Generate an Ed25519 keypair (prints PEM)
  mandateseal pubkey                      Fetch the server's public key
  mandateseal --help                      Show this help

Env:
  MANDATESEAL_BASE_URL    default: http://localhost:3000`);
}

function getArg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}

function hasFlag(name) {
  return argv.includes(name);
}

async function postJson(path, body, headers = {}) {
  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

async function getJson(path) {
  const res = await fetch(BASE_URL + path);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: res.ok, status: res.status, data };
}

function readJsonFile(p) {
  if (!existsSync(p)) {
    console.error(`error: file not found: ${p}`);
    exit(1);
  }
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`error: invalid JSON in ${p}: ${e.message}`);
    exit(1);
  }
}

// Canonical JSON — must match src/lib/canonical.ts exactly.
function canonicalize(value) {
  return JSON.stringify(canonical(value));
}
function canonical(value) {
  if (value === null) return null;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonical);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const v = value[key];
    if (v === undefined) continue;
    out[key] = canonical(v);
  }
  return out;
}

function verifyOfflineLocal(receipt, publicKeyPem) {
  const reasons = [];
  const unsigned = {
    id: receipt.id,
    agentId: receipt.agentId,
    mandateId: receipt.mandateId,
    actionType: receipt.actionType,
    tool: receipt.tool,
    target: receipt.target,
    costUsd: receipt.costUsd,
    decision: receipt.decision,
    reason: receipt.reason,
    matchedRule: receipt.matchedRule,
    riskLevel: receipt.riskLevel,
    timestamp: receipt.timestamp,
    policyHash: receipt.policyHash,
    rawPayload: receipt.rawPayload ?? {},
  };
  const expectedReceiptHash = createHash("sha256").update(canonicalize(unsigned)).digest("hex");
  if (expectedReceiptHash !== receipt.receiptHash) {
    reasons.push("receiptHash does not match canonical payload");
  }
  const signedPayload = canonicalize({ ...unsigned, receiptHash: expectedReceiptHash });
  try {
    const ok = cryptoVerify(
      null,
      Buffer.from(signedPayload, "utf8"),
      createPublicKey(publicKeyPem),
      Buffer.from(receipt.signature, "base64"),
    );
    if (!ok) reasons.push("signature does not match Ed25519 public key");
  } catch (e) {
    reasons.push("signature parse error: " + e.message);
  }
  return { valid: reasons.length === 0, reasons };
}

// ─── verify ──────────────────────────────────────────────────────────────────
async function cmdVerify() {
  const offline = hasFlag("--offline");
  const file = argv.filter((a, i) => i >= 3 && !a.startsWith("--") && argv[i - 1] !== "--pub")[0];
  if (!file) {
    console.error("usage: mandateseal verify <receipt.json> [--offline --pub key.pem]");
    exit(1);
  }
  const receipt = readJsonFile(file);

  if (offline) {
    const pubPath = getArg("--pub");
    if (!pubPath) {
      console.error("--offline requires --pub <public-key.pem>");
      exit(1);
    }
    if (!existsSync(pubPath)) {
      console.error(`error: pub key not found: ${pubPath}`);
      exit(1);
    }
    const pubPem = readFileSync(pubPath, "utf8");
    const r = verifyOfflineLocal(receipt, pubPem);
    printVerifyResult(r);
    exit(r.valid ? 0 : 1);
  }

  // Server verification
  const body = receipt.id && Object.keys(receipt).length === 1 ? { id: receipt.id } : receipt;
  const { ok, data } = await postJson("/api/verify", body);
  if (!ok) {
    console.error(`error: ${data?.error ?? "verify failed"}`);
    exit(2);
  }
  printVerifyResult(data);
  exit(data.valid ? 0 : 1);
}

function printVerifyResult(r) {
  if (r.valid) {
    console.log("✓ VALID");
  } else {
    console.log("✗ INVALID");
    for (const reason of r.reasons ?? []) {
      console.log(`  · ${reason}`);
    }
  }
  if (r.reEvaluation) {
    const m = r.reEvaluation.matched;
    console.log(`  re-evaluation: ${m ? "matched ✓" : "mismatch ✗"}`);
  }
}

// ─── tail ────────────────────────────────────────────────────────────────────
async function cmdTail() {
  const agentId = getArg("--agent");
  const limit = Number(getArg("--limit") ?? "20") || 20;
  const intervalMs = (Number(getArg("--interval") ?? "2") || 2) * 1000;
  const seen = new Set();

  console.log(`[mandateseal] tailing ${BASE_URL}/api/receipts${agentId ? ` (agent=${agentId})` : ""}`);
  console.log("[mandateseal] ctrl-c to stop\n");

  // Print initial batch then poll for new ones.
  const initial = await fetchReceipts({ agentId, limit });
  for (const r of initial.reverse()) {
    seen.add(r.id);
    printReceiptLine(r);
  }

  while (true) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const fresh = await fetchReceipts({ agentId, limit });
    for (const r of fresh.reverse()) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        printReceiptLine(r);
      }
    }
  }
}

async function fetchReceipts({ agentId, limit }) {
  const qs = new URLSearchParams();
  if (agentId) qs.set("agentId", agentId);
  if (limit) qs.set("limit", String(limit));
  const { ok, data } = await getJson("/api/receipts" + (qs.toString() ? "?" + qs.toString() : ""));
  if (!ok) {
    console.error("[mandateseal] fetch failed:", data?.error ?? "unknown");
    return [];
  }
  return data.receipts ?? [];
}

function printReceiptLine(r) {
  const tone =
    r.decision === "APPROVED" ? "\x1b[32m" : r.decision === "BLOCKED" ? "\x1b[31m" : "\x1b[33m";
  const reset = "\x1b[0m";
  console.log(
    `${r.timestamp.slice(0, 19).replace("T", " ")}  ${tone}${r.decision.padEnd(15)}${reset}` +
      `  ${r.riskLevel.padEnd(6)}  ${r.actionType.padEnd(24)}  ${r.target.slice(0, 50)}`,
  );
}

// ─── check ───────────────────────────────────────────────────────────────────
async function cmdCheck() {
  const file = argv.filter((a, i) => i >= 3 && !a.startsWith("--") && argv[i - 1] !== "--key")[0];
  const apiKey = getArg("--key") || env.MANDATESEAL_API_KEY;
  if (!file || !apiKey) {
    console.error("usage: mandateseal check <action.json> --key <apiKey>   (or set MANDATESEAL_API_KEY)");
    exit(1);
  }
  const action = readJsonFile(file);
  const { ok, status, data } = await postJson("/api/check", action, {
    authorization: `Bearer ${apiKey}`,
  });
  if (!ok) {
    console.error(`error (${status}): ${data?.error ?? "check failed"}`);
    exit(2);
  }
  console.log(`${data.decision}  ${data.matchedRule}  risk=${data.riskLevel}`);
  console.log(`receipt ${data.receipt.id}`);
  if (data.receipt.approval) {
    console.log(`approval ${data.receipt.approval.id}  status=${data.receipt.approval.status}`);
  }
}

// ─── gen-keys ────────────────────────────────────────────────────────────────
function cmdGenKeys() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const priv = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const pub = publicKey.export({ type: "spki", format: "pem" }).toString();

  if (hasFlag("--write")) {
    writeFileSync("./mandateseal-private.pem", priv, { mode: 0o600 });
    writeFileSync("./mandateseal-public.pem", pub);
    console.log("wrote ./mandateseal-private.pem (0600) and ./mandateseal-public.pem");
  }

  console.log("# Private key (PKCS#8 PEM)");
  console.log(priv.trim());
  console.log("\n# Public key (SPKI PEM)");
  console.log(pub.trim());
  console.log("\n# Base64 for .env");
  console.log(`MANDATESEAL_PRIVATE_KEY_B64="${Buffer.from(priv).toString("base64")}"`);
  console.log(`MANDATESEAL_PUBLIC_KEY_B64="${Buffer.from(pub).toString("base64")}"`);
}

// ─── pubkey ──────────────────────────────────────────────────────────────────
async function cmdPubkey() {
  const res = await fetch(BASE_URL + "/api/key.pub");
  if (!res.ok) {
    console.error(`error: ${res.status}`);
    exit(1);
  }
  console.log(await res.text());
}

// ─── main ────────────────────────────────────────────────────────────────────
const cmd = argv[2];
try {
  switch (cmd) {
    case "verify":   await cmdVerify(); break;
    case "tail":     await cmdTail(); break;
    case "check":    await cmdCheck(); break;
    case "gen-keys": cmdGenKeys(); break;
    case "pubkey":   await cmdPubkey(); break;
    case "-h":
    case "--help":
    case "help":
    case undefined:  printHelp(); break;
    default:
      console.error(`unknown command: ${cmd}`);
      printHelp();
      exit(1);
  }
} catch (e) {
  console.error("error:", e.message ?? e);
  exit(1);
}
