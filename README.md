# MandateSeal

> **Approve before. Prove after.**
> A trust layer for autonomous AI agents — pre-action mandate enforcement and post-action signed receipts.

```
AGENT WANTS TO ACT
        │
        ▼
   POST /api/check  ──►  MandateSeal
        │                  │
        │                  ├─ run 10-rule policy engine
        │                  ├─ produce decision  (APPROVED · BLOCKED · NEEDS_APPROVAL)
        │                  └─ sign receipt      (canonical JSON + Ed25519)
        │
        ▼
  if APPROVED → agent runs the action
  if BLOCKED  → agent stops
  if NEEDS_APPROVAL → human queue (v0.2)
        │
        ▼
   POST /api/verify  ──►  anyone, any time
        │
        ▼
  { valid: true | false, reasons: [...] }
```

---

## Table of contents

- [Why MandateSeal exists](#why-mandateseal-exists)
- [The two halves](#the-two-halves)
- [Core concepts](#core-concepts)
- [End-to-end workflow](#end-to-end-workflow)
- [Quickstart](#quickstart)
- [The policy engine — 10 rules in order](#the-policy-engine--10-rules-in-order)
- [The signed receipt](#the-signed-receipt)
- [API reference](#api-reference)
- [TypeScript SDK](#typescript-sdk)
- [Dashboard tour](#dashboard-tour)
- [Default demo data](#default-demo-data)
- [Use cases](#use-cases)
- [Project structure](#project-structure)
- [Tech stack](#tech-stack)
- [Out of scope (current MVP)](#out-of-scope-current-mvp)
- [Roadmap](#roadmap)

---

## Why MandateSeal exists

Autonomous AI agents already write code, send emails, hit paid APIs, call wallets, run shells. The industry's answer to *"is this safe?"* today is **prompts and prayers**:

- a system prompt that says *"please don't do anything bad"*
- model providers' built-in refusals (override-able)
- ad-hoc allow-lists buried in tool definitions
- and a log file that's only inspected after something goes wrong

That's not accountability. That's a story you tell yourself between incidents.

**MandateSeal turns "trust the model" into "verify the action."** Every action the agent wants to take must pass an explicit, declarative mandate *before* it runs, and every decision MandateSeal makes is sealed in a cryptographically verifiable receipt *after*. The log isn't a fallback. The log **is** the contract.

> Autonomy needs accountability.
> A mandate before every action.
> A receipt after every action.
> Trust is a log, not a promise.

---

## The two halves

| Half | When | Mechanism | Output |
|---|---|---|---|
| **Approve before** | Pre-action | Bearer-authed `POST /api/check`. Runs a 10-rule policy engine against the agent's active mandate. | `decision`: `APPROVED` · `BLOCKED` · `NEEDS_APPROVAL` |
| **Prove after** | After the decision | Same call seals a **preflight receipt**: canonical JSON of mandate + action + decision, SHA-256 hashed, Ed25519 signed. The receipt proves what was decided. | Tamper-evident `receipt` anyone can later verify |

A single API call covers both halves. The agent doesn't need to call MandateSeal twice.

> **Lifecycle note.** v0.1–v0.9 seal only the *preflight* receipt — proof that the policy engine ran and produced a decision. The agent (or the proxy at `/api/proxy/:tool`) executes downstream and **execution-outcome receipts are not yet sealed**. v0.7.1 will close this loop with a second sealed receipt covering upstream status, duration, and bytes returned.

---

## Core concepts

### Agent
An autonomous actor (LLM agent, scheduled job, AI assistant) registered with MandateSeal. Each agent has:
- a stable `id` (`agent_xxx`)
- a name + role
- an **API key** (raw key shown once at creation, only the SHA-256 hash is stored)
- a status (`active`, etc.)

### Mandate
A declarative policy contract bound to one agent. Every field is enforced at decision time:

| Field | Type | Meaning |
|---|---|---|
| `enabled` | bool | If `false`, all actions APPROVED (mandate off) |
| `dailyBudgetUsd` | float | Daily spend ceiling (enforcement: v0.6) |
| `maxCostPerActionUsd` | float | Per-action cost ceiling |
| `approvalThresholdUsd` | float | Cost above this → NEEDS_APPROVAL |
| `allowedTools` | string[] | If non-empty, only these tools allowed |
| `blockedTools` | string[] | Tools that always BLOCKED |
| `blockedActions` | string[] | Action types that always BLOCKED |
| `approvalRequiredActions` | string[] | Action types that always NEEDS_APPROVAL |
| `allowedDomains` | string[] | If non-empty, only these domains allowed |
| `blockedDomains` | string[] | Domains that always BLOCKED |

### Action
What the agent wants to do — submitted to `/api/check`:
```json
{
  "agentId": "agent_atlas_01",
  "actionType": "paid_api_call",
  "tool": "paid_api_call",
  "target": "https://api.openai.com/v1/responses",
  "costUsd": 0.02,
  "metadata": { /* optional, opaque */ }
}
```

### Decision
The verdict produced by the policy engine:
- `decision`: `APPROVED` · `BLOCKED` · `NEEDS_APPROVAL`
- `reason`: human-readable explanation
- `matchedRule`: the policy rule that fired (e.g. `blockedTools ∋ "wallet_transfer"`)
- `riskLevel`: `LOW` · `MEDIUM` · `HIGH`

### Receipt
The sealed proof of decision. Persisted on the server, returned to the caller, verifiable forever by anyone holding the public verifier.

```json
{
  "id": "rct_xxxxxxx",
  "agentId": "...",
  "mandateId": "...",
  "actionType": "...",
  "tool": "...",
  "target": "...",
  "costUsd": 0.02,
  "decision": "APPROVED",
  "reason": "...",
  "matchedRule": "default.allow",
  "riskLevel": "LOW",
  "timestamp": "2026-05-27T00:00:00.000Z",
  "policyHash": "sha256(canonical(mandate + action + decision))",
  "receiptHash": "sha256(canonical(receipt without signature))",
  "signature": "ed25519_sign(canonical(receipt including receiptHash, excluding signature))",
  "rawPayload": { /* original action */ }
}
```

---

## End-to-end workflow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   1. DEVELOPER SETUP                                                     │
│      ├─ npm run setup     # prisma generate + db push + seed             │
│      └─ Atlas-01 agent + research-budget-v1 mandate seeded               │
│         (API key printed once to terminal)                               │
│                                                                          │
│   2. AGENT REGISTRATION  (optional — additional agents)                  │
│      POST /api/agents                                                    │
│      └─ response includes apiKey (shown ONCE, never readable again)      │
│                                                                          │
│   3. MANDATE DEFINITION                                                  │
│      POST /api/mandates  /  PATCH /api/mandates/:id                      │
│      └─ allowed/blocked tools, domains, actions, cost limits             │
│                                                                          │
│   4. AGENT PREFLIGHT  (the wire contract)                                │
│      POST /api/check                                                     │
│      Authorization: Bearer <agent_api_key>                               │
│      body: { agentId, actionType, tool, target, costUsd }                │
│         │                                                                │
│         │  policy engine runs                                            │
│         │  10 rules in order, short-circuit on first match               │
│         ▼                                                                │
│      response: { decision, reason, matchedRule, riskLevel, receipt }     │
│                                                                          │
│   5. AGENT DECIDES                                                       │
│      ├─ APPROVED        → run the action                                 │
│      ├─ BLOCKED         → abort                                          │
│      └─ NEEDS_APPROVAL  → wait for human (v0.2 queue)                    │
│                                                                          │
│   6. VERIFICATION (now or later, by anyone)                              │
│      POST /api/verify    body: { id } OR full receipt JSON               │
│      └─ recomputes canonical hash + Ed25519 signature                    │
│      └─ returns { valid: true | false, reasons: [...] }                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Quickstart

### Requirements
- Node.js 18+
- npm

### Setup

Postgres required (Supabase free works fine — see [Production deploy → Postgres](#2--postgres-recommended-supabase-free-or-any-managed-postgres)).

```bash
npm install                          # installs deps + runs prisma generate
# point DATABASE_URL + DIRECT_URL at your Postgres in .env (see .env.example)
npx prisma migrate dev --name init   # applies migrations, creates prisma/migrations/
npx tsx prisma/seed.ts               # seeds Atlas-01 + research-budget-v1, prints demo API key
npm run dev                          # http://localhost:3000
```

The seed script prints a demo API key to your terminal **once**. Copy it before the screen scrolls away.

### .env (copy from `.env.example`)
```
DATABASE_URL="postgresql://postgres.<ref>:<pass>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<ref>:<pass>@<region>.pooler.supabase.com:5432/postgres"

# Leave empty in dev — auto-generated. For prod use `npm run cli -- gen-keys`.
MANDATESEAL_PRIVATE_KEY_B64=""
MANDATESEAL_PUBLIC_KEY_B64=""

# Leave empty in dev = open dashboard. Set both to enforce SIWE login.
# MANDATESEAL_ADMIN_ADDRESSES = comma-separated 0x-addresses allowed to sign in.
MANDATESEAL_ADMIN_ADDRESSES=""
MANDATESEAL_SESSION_SECRET=""

# Optional — WalletConnect Cloud project ID for mobile / WC-based wallets.
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=""
```

Postgres password tip: keep it alphanumeric + `._-`. Special chars like `@ # $ ? &` need URL-encoding and can confuse Prisma's URL parser.

### Encoding note

All files, API responses, and DB content are **UTF-8**. Receipts use Unicode glyphs in `matchedRule` (e.g. `blockedTools ∋ "wallet_transfer"`). If you see mojibake (`Â·`, `â†'`, `âœ"`) when reading via PowerShell or opening CSV in Excel, the reader is decoding as Latin-1/CP1252. Fixes:

- **PowerShell**: run `chcp 65001` once per session, or use Windows Terminal / Git Bash.
- **Excel**: CSV exports already include a UTF-8 BOM — Excel will auto-detect. If it still mangles, use Data → From Text/CSV → UTF-8.
- **Signatures and verification** operate on raw bytes, so display issues never affect cryptographic correctness.

### Verify it's alive
```bash
# list seeded agent
curl http://localhost:3000/api/agents

# run a preflight (use the demo key from seed)
curl -X POST http://localhost:3000/api/check \
  -H "Authorization: Bearer msk_demo_xxx" \
  -H "content-type: application/json" \
  -d '{
    "agentId": "agent_atlas_01",
    "actionType": "paid_api_call",
    "tool": "paid_api_call",
    "target": "https://api.openai.com/v1/responses",
    "costUsd": 0.02
  }'
```

Expected output: `decision: "APPROVED"`, `matchedRule: "default.allow"`, plus a full signed receipt.

---

## The policy engine — 10 rules in order

The engine in [`src/lib/policy.ts`](src/lib/policy.ts) evaluates these in exactly this order and **short-circuits on first match**. Order matters — `blockedTools` fires before `blockedActions`, and cost rules fire before approval-required-actions.

| # | Rule | Decision | Risk |
|---|---|---|---|
| 1 | `mandate.enabled === false` | `APPROVED` | LOW |
| 2 | `tool ∈ blockedTools` | `BLOCKED` | HIGH if wallet/shell/private_key/delete/transfer in name, else MEDIUM |
| 3 | `actionType ∈ blockedActions` | `BLOCKED` | same heuristic |
| 4 | `targetDomain ∈ blockedDomains` | `BLOCKED` | HIGH |
| 5 | `costUsd > maxCostPerActionUsd` | `BLOCKED` | MEDIUM |
| 6 | `costUsd > approvalThresholdUsd` | `NEEDS_APPROVAL` | MEDIUM |
| 7 | `actionType ∈ approvalRequiredActions` | `NEEDS_APPROVAL` | MEDIUM |
| 8 | `allowedTools` non-empty AND `tool ∉ allowedTools` | `BLOCKED` | MEDIUM |
| 9 | `allowedDomains` non-empty AND `targetDomain ∉ allowedDomains` | `BLOCKED` | MEDIUM |
| 10 | (default) | `APPROVED` | LOW |

### Why this order
- Block lists override allow lists (defense in depth — a tool can be both `allowedTools` and `blockedTools`; blocked wins).
- Cost violations BLOCK before approval-required actions can NEEDS_APPROVAL, because exceeding the hard cap is more serious than triggering a soft gate.
- Allow-list checks come last so that an explicit allow-list still admits an otherwise-default action.

---

## The signed receipt

### Canonical JSON
Before any hashing, the payload is serialized via [`src/lib/canonical.ts`](src/lib/canonical.ts): keys sorted alphabetically at every nesting level, `undefined` values dropped, arrays preserve order. **Same logical payload → byte-identical bytes.** This is the only way `policyHash` and `receiptHash` can be deterministically recomputed by a verifier.

### Three hashes
```
policyHash   = sha256(canonical({ mandate, action, decision }))
receiptHash  = sha256(canonical(receipt MINUS signature))
signature    = ed25519_sign(canonical(receipt INCLUDING receiptHash, MINUS signature), MANDATESEAL_PRIVATE_KEY)
```

### Verification
[`/api/verify`](src/app/api/verify/route.ts) accepts either:
- `{ "id": "rct_xxx" }` — look up stored receipt, recompute, compare
- a full receipt JSON — recompute against caller's payload (third-party verification)

It returns:
```json
{
  "valid": true,
  "reasons": []
}
```
or, on tamper:
```json
{
  "valid": false,
  "reasons": [
    "receiptHash does not match canonical payload",
    "signature does not match Ed25519 public key"
  ]
}
```

### Signature scheme
**Ed25519** asymmetric. MandateSeal signs every receipt with its private key. The matching public key is exposed at `GET /api/key.pub` as a PEM file. Anyone can verify a receipt offline without ever holding MandateSeal's secret:

```bash
curl http://localhost:3000/api/key.pub > mandateseal.pub.pem
# verify a stored receipt via the server
curl -X POST http://localhost:3000/api/verify -H "content-type: application/json" -d '{"id":"rct_xxx"}'
```

The signature is base64-encoded raw Ed25519 (88 chars). Receipts also include a `mandateSnapshot` inside `rawPayload` so an auditor can reproduce the decision even after the live mandate has been edited.

---

## API reference

All routes live under [`src/app/api/`](src/app/api/). All require `content-type: application/json` on POST/PATCH.

### Agents

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/agents` | none | — | `{ agents: [...] }` |
| `POST` | `/api/agents` | none | `{ name, role }` | `{ agent, mandate, apiKey }` — **`apiKey` shown once**; default mandate auto-created |
| `GET` | `/api/agents/:id` | none | — | `{ agent }` |
| `DELETE` | `/api/agents/:id` | none | — | `{ ok: true }` — cascades to mandates + receipts |
| `POST` | `/api/agents/:id/rotate-key` | none | — | `{ agent, apiKey }` — invalidates previous key, new raw key shown once |

### Mandates

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/mandates?agentId=X` | none | — | `{ mandates: [...] }` |
| `POST` | `/api/mandates` | none | full mandate object | `{ mandate }` |
| `GET` | `/api/mandates/:id` | none | — | `{ mandate }` |
| `PATCH` | `/api/mandates/:id` | none | partial mandate | `{ mandate }` |
| `DELETE` | `/api/mandates/:id` | none | — | `{ ok: true }` |

### Check (the wire contract)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/check` | **`Authorization: Bearer <apiKey>`** | action | `{ decision, reason, matchedRule, riskLevel, receipt }` |

Returns `401` on missing/invalid bearer, `403` if `agentId` in body ≠ authenticated agent, `400` on malformed action.

### Receipts

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/receipts?...` | admin | — | `{ receipts, pagination }` — supports filters: `agentId`, `mandateId`, `decision`, `riskLevel`, `tool`, `actionType`, `from`, `to`, `costMin`, `costMax`, `q`, `limit`, `offset`. Add `format=csv` for export. |
| `POST` | `/api/receipts` | none | action | `{ receipt }` — same engine as `/api/check` but unauth (dashboard simulator path) |

### Verify

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/verify` | none | `{ id }` or full receipt JSON | `{ valid, reasons, reEvaluation, receipt? }` |
| `GET` | `/api/key.pub` | none | — | Ed25519 public key (PEM, `application/x-pem-file`) |

### Audit (v0.4)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/audit/integrity?agentId=X&limit=N` | admin | — | `{ scanned, valid, invalid, integrity, durationMs, failures: [...] }` |
| `GET` | `/api/audit/stats?from=&to=` | admin | — | `{ total, totalCostUsd, byDecision, topTools, topActions, topMatchedRules, perAgent, perMandate }` |
| `GET` | `/api/audit/spend` | admin | — | `{ agents: [{ agentId, dailyBudgetUsd, todayUsd, weekUsd, monthUsd, totalUsd, todayPctOfBudget }] }` |

### Tools & Proxy (v0.7)

A tool is an upstream HTTP endpoint MandateSeal can proxy to. Agents call `/api/proxy/<name>` with a Bearer key; MandateSeal runs the policy engine (using the tool name as `tool`), seals a receipt, then forwards to the upstream if APPROVED.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/tools` | admin | — | `{ tools: [...] }` |
| `POST` | `/api/tools` | admin | `{ name, endpoint, method?, defaultCostUsd?, description?, enabled? }` | `{ tool }` |
| `GET` | `/api/tools/:id` | admin | — | `{ tool }` (accepts name or id) |
| `PATCH` | `/api/tools/:id` | admin | partial Tool | `{ tool }` |
| `DELETE` | `/api/tools/:id` | admin | — | `{ ok: true }` |
| `POST` | `/api/proxy/:tool` | **Bearer** | upstream body | upstream response, with headers `X-MandateSeal-Receipt`, `X-MandateSeal-Decision`, `X-MandateSeal-Upstream-Status`, `X-MandateSeal-Duration-Ms` |

The proxy strips `Authorization`, `Cookie`, `Host`, `Content-Length` before forwarding. Adds `User-Agent: MandateSeal-Proxy/0.7 (agent=… tool=…)` and the receipt id. 25 s upstream timeout → 504.

### Webhooks (v0.8)

Subscribe URLs to push notifications. Every matching event fans out a signed JSON envelope with retries. Receivers verify `X-MandateSeal-Signature` (Ed25519, base64) against `/api/key.pub`.

Supported events: `receipt.created`, `receipt.blocked`, `receipt.needs_approval`, `approval.requested`, `approval.decided`. Retry policy: 4 attempts at 0 s / 1 s / 5 s / 30 s, then status `failed`.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/webhooks` | admin | — | `{ webhooks: [...] }` |
| `POST` | `/api/webhooks` | admin | `{ name, url, events: [...], enabled? }` | `{ webhook }` |
| `GET` | `/api/webhooks/:id` | admin | — | `{ webhook }` |
| `PATCH` | `/api/webhooks/:id` | admin | partial Webhook | `{ webhook }` |
| `DELETE` | `/api/webhooks/:id` | admin | — | `{ ok: true }` (cascades deliveries) |
| `GET` | `/api/webhooks/:id/deliveries?limit=N` | admin | — | `{ deliveries: [...] }` |

Delivery envelope (`POST` body):
```json
{
  "event": "receipt.created",
  "timestamp": "2026-05-27T02:35:35.031Z",
  "data": { "receipt": { ... } }
}
```

### Onchain Anchors (v0.9)

Receipts get bundled into merkle batches. Every batch's `root` is linked to the previous batch's via `prevRoot`, forming a tamper-evident hash chain. Each anchored receipt can be served a sibling-path proof; anyone (no DB needed) can recompute leaf → path → root and confirm membership.

Current MVP **stores roots locally only**. v0.9.1 will broadcast each root to Base via a dumb `mapping(uint=>bytes32)` contract — then verification becomes "read root from chain, recompute proof" with zero MandateSeal trust.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/anchor` | admin | — | `{ batches: [...], pendingReceipts }` |
| `POST` | `/api/anchor` | admin | — | `{ batch, leafCount }` — seals all unanchored receipts into next batch |
| `GET` | `/api/anchor/proof?receiptId=X` | admin | — | `{ receiptId, receiptHash, batchIndex, root, prevRoot, proof: [...], leafIndex }` |
| `POST` | `/api/anchor/verify` | none | `{ receiptHash, proof, root }` | `{ valid }` — standalone, no DB |
| `GET` | `/api/anchor/audit` | admin | — | `{ scanned, valid, invalid, failures }` — recompute every root + check chain |

Merkle construction (compatibility-first so any external verifier can reproduce):
- leaf hash: `sha256("L:" + leafHex)`
- node hash: `sha256("N:" + sortPair(left, right))` — commutative concat, no left/right bit
- odd siblings duplicated
- empty tree → `"0".repeat(64)`

### Approvals (v0.2)

Every `NEEDS_APPROVAL` decision automatically opens an `Approval` workflow record. Default TTL 30 minutes; overdue approvals are lazily marked `expired` on read.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/approvals?status=pending&agentId=X&limit=N` | admin | — | `{ approvals: [...] }` |
| `GET` | `/api/approvals/:id` | admin | — | `{ approval, receipt }` |
| `POST` | `/api/approvals/:id/approve` | admin | `{ decidedBy?, decisionNote? }` | `{ approval }` |
| `POST` | `/api/approvals/:id/deny` | admin | `{ decidedBy?, decisionNote? }` | `{ approval }` |
| `GET` | `/api/approvals/:id/wait?timeoutMs=25000` | none | — | `{ approval, timedOut? }` — long-poll until resolved |

`POST /api/check` and `POST /api/receipts` return `receipt.approval` when the decision is `NEEDS_APPROVAL`. SDK callers can pass that `approval.id` to `waitForApproval()` and block until a human resolves it.

### Auth (dashboard)

When `MANDATESEAL_ADMIN_ADDRESSES` is set, the dashboard pages and admin API routes require a SIWE-signed session cookie. The user connects a wallet, signs a nonce-bound message (no gas, no tx), and the server issues an HMAC-MAC'd session cookie if the recovered address is in the allowlist.

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET`  | `/api/auth/nonce`  | none   | — | `{ nonce }` + `mandateseal_siwe_nonce` cookie |
| `POST` | `/api/auth/siwe`   | nonce  | `{ message, signature }` | `{ ok: true, address }` + `mandateseal_session` cookie |
| `POST` | `/api/auth/logout` | cookie | — | `{ ok: true }` |

Unauthenticated requests to `/dashboard`, `/agents`, `/mandates`, `/receipts`, `/approvals` 307-redirect to `/login`. Unauthenticated requests to mutating admin API routes (and admin GET listings) return 401. `/api/check` is bearer-only and not affected. `/api/verify`, `/api/key.pub`, and `/api/approvals/:id/wait` stay public so SDK callers and external verifiers don't need session.

---

## TypeScript SDK

[`src/sdk/mandateseal.ts`](src/sdk/mandateseal.ts) — zero-dependency, browser + Node compatible. Import via barrel:

```ts
import { MandateSeal, MandateSealError } from "@/sdk";

const seal = new MandateSeal({
  apiKey: process.env.MANDATESEAL_API_KEY!,
  baseUrl: "http://localhost:3000",
});
```

### The one-line pattern: `seal.guard()`

Wrap any agent action with `seal.guard(action, runFn)`. It does the full flow:

```ts
const result = await seal.guard(
  {
    agentId: "agent_atlas_01",
    actionType: "paid_api_call",
    tool: "paid_api_call",
    target: "https://api.openai.com/v1/responses",
    costUsd: 0.02,
  },
  async () => openai.responses.create({ model: "gpt-5", input: prompt }),
);

// result.value  → whatever runFn returned
// result.receipt → signed Ed25519 receipt
```

Behavior:
- `APPROVED` → `runFn` executes, value returned.
- `BLOCKED` → throws `MandateSealError` with `body.decision` / `body.matchedRule` / `body.receipt`.
- `NEEDS_APPROVAL` → blocks on `waitForApproval()`. Approved → runs and returns. Denied/expired → throws.

Catch the error for typed handling:
```ts
import { MandateSealError } from "@/sdk";

try {
  await seal.guard(action, runFn);
} catch (e) {
  if (e instanceof MandateSealError && e.isGuardError()) {
    // e.body is now narrowed to GuardErrorBody
    if (e.body.decision === "BLOCKED") {
      log.warn("mandate blocked", { rule: e.body.matchedRule, receipt: e.body.receipt.id });
    } else if (e.body.approval?.status === "denied") {
      log.info("human denied", { note: e.body.approval.decisionNote });
    }
  } else {
    throw e;
  }
}
```

### Named primitives

| Method | What it does |
|---|---|
| `check(action)` | bearer-auth preflight → `{ decision, reason, matchedRule, riskLevel, receipt }` |
| `seal(action)` | alias of `createReceipt` — generate a signed receipt without bearer |
| `verify(receipt \| {id})` | alias of `verifyReceipt` — `{ valid, reasons, reEvaluation? }` |
| `guard(action, fn)` | preflight → optionally wait approval → run `fn` → return value |
| `waitForApproval(id, { pollUntilMs? })` | long-poll until `pending → approved/denied/expired` |
| `approveAction(id, { decidedBy?, decisionNote? })` | admin — resolve approval |
| `denyAction(id, { decidedBy?, decisionNote? })` | admin — resolve approval |
| `listReceipts({ agentId?, limit? })` | recent receipts |
| `getPublicKey()` | fetch server's Ed25519 PEM for offline verification |
| `verifyOfflineNode(receipt, pem)` | standalone helper — verify without network |
| `auditIntegrity({ agentId?, limit? })` | recompute every receipt's hash + signature; returns `{ scanned, valid, invalid, integrity, failures }` |
| `auditStats({ from?, to? })` | per-decision / per-agent / per-mandate aggregates + top rules / tools / actions |
| `auditSpend()` | per-agent today / 7d / 30d / total cost + daily-budget utilization |
| `listTools()` | enumerate registered tools |
| `registerTool({ name, endpoint, method?, ... })` | admin — register an upstream HTTP tool |
| `invokeTool(name, body)` | bearer — proxy a call: server checks mandate, seals receipt, forwards if APPROVED. Returns `Response` (headers contain receipt id + decision) |
| `listWebhooks()` | enumerate webhook subscriptions |
| `registerWebhook({ name, url, events })` | subscribe a URL to events |
| `listWebhookDeliveries(id)` | recent delivery rows with status / attempts / error |
| `listAnchorBatches()` | merkle batches + pending receipt count |
| `sealAnchor()` | bundle all unanchored receipts into next batch |
| `getAnchorProof(receiptId)` | sibling-path proof for receipt's batch root |
| `verifyAnchorProof({ receiptHash, proof, root })` | standalone proof verification |
| `auditAnchorChain()` | recompute every batch root + chain link audit |

---

## CLI (v0.3)

A small zero-dep Node CLI ships with the package at [`bin/mandateseal.mjs`](bin/mandateseal.mjs). Once published it runs as `npx mandateseal …`; locally use `npm run cli …`.

```bash
# Run a preflight from a JSON file
npm run cli -- check ./action.json --key msk_demo_xxx

# Verify a stored receipt against the running server
npm run cli -- verify ./receipt.json

# Verify completely offline (no network) using a saved public key
npm run cli -- verify --offline ./receipt.json --pub ./pub.pem

# Stream new receipts as they're sealed
npm run cli -- tail --agent agent_atlas_01 --interval 2

# Generate a fresh Ed25519 keypair for production env vars
npm run cli -- gen-keys --write

# Fetch the server's public key
npm run cli -- pubkey > mandateseal.pub.pem
```

Env: `MANDATESEAL_BASE_URL` (default `http://localhost:3000`), `MANDATESEAL_API_KEY` (used by `check` if `--key` omitted).

**Exit codes** (scriptable):

| Code | Meaning |
|---|---|
| `0` | success / receipt valid |
| `1` | receipt invalid (`verify`) or argument error |
| `2` | server / network error |

---

## Dashboard tour

The dashboard at [`/dashboard`](src/app/dashboard/page.tsx) is the operator console.

| Section | What it does |
|---|---|
| **01 Agent Profile** | Shows the active agent's name/role/id. Create new agents (raw API key shown once). |
| **02 Mandate Builder** | Edit budgets, thresholds, allowed/blocked tools/actions/domains, approval-required actions. Save persists via `PATCH /api/mandates/:id`. |
| **03 Action Simulator** | 6 preset actions covering all decision branches: paid API, email, USDC transfer, shell, private file, buy dataset. Click → runs `/api/receipts` → seals. |
| **04 Decision Card** | Decision badge (APPROVED stamp green / BLOCKED red / NEEDS_APPROVAL amber), reason, matched rule, risk, timestamp. |
| **05 Signed Receipt Card** | Full receipt with policy/receipt/signature hashes. Verify button calls `/api/verify`. Copy JSON / Copy Share text. |
| **06 Receipt Archive** | Tabular history. Per-row Verify. |

Other top-nav pages:
- `/agents` — registry, rotate keys, delete agents
- `/mandates` — all mandates with field summaries
- `/tools` — register / disable / delete upstream HTTP tools for proxy use
- `/webhooks` — register webhook subscriptions + delivery log
- `/anchor` — seal merkle batches + run chain integrity audit
- `/receipts` — global archive across all agents
- `/approvals` — pending queue + recently resolved
- `/audit` — integrity scan + per-agent / per-mandate / per-rule analytics
- `/spend` — per-agent daily / 7d / 30d burn with budget utilization
- `/r/:id` — **public** receipt page (no auth) with Verify + OG share preview
- `/a/:id` — **public** agent profile with stats + recent receipts
- `/verify` — paste a receipt JSON or enter an ID to verify
- `/docs` — quickstart
- `/login` — when `MANDATESEAL_ADMIN_ADDRESSES` is set (SIWE / RainbowKit)

---

## Default demo data

Seeded by [`prisma/seed.ts`](prisma/seed.ts):

**Agent — `Atlas-01`**
- id: `agent_atlas_01`
- role: Autonomous Research Agent
- status: active

**Mandate — `research-budget-v1`**
```yaml
dailyBudgetUsd:        25
maxCostPerActionUsd:    2
approvalThresholdUsd:   5

allowedTools:           [web_search, paid_api_call, file_reader, email_draft]
blockedTools:           [wallet_transfer, shell_exec, private_key_reader]

blockedActions:         [transfer_usdc, delete_files, execute_shell_command, access_private_keys]
approvalRequiredActions:[send_email, buy_dataset]

allowedDomains:         [api.openai.com, github.com, docs.coinbase.com]
blockedDomains:         [unknown-wallet.site, private-keys.local]
```

The 6 preset actions in the simulator are designed to exercise every distinct branch of the policy engine:

| Preset | Trace through rules | Outcome |
|---|---|---|
| Call paid API ($0.02) | passes all → rule 10 default | **APPROVED** LOW |
| Send email | passes 1–6 → rule 7 (approval-required) | **NEEDS_APPROVAL** MEDIUM |
| Transfer USDC ($12) | rule 2 (`wallet_transfer` in blockedTools) | **BLOCKED** HIGH |
| Run shell | rule 2 (`shell_exec` in blockedTools) | **BLOCKED** HIGH |
| Read private file | rule 4 (`private-keys.local` in blockedDomains) | **BLOCKED** HIGH |
| Buy dataset ($3.50) | rule 5 (cost $3.50 > max $2) | **BLOCKED** MEDIUM |

---

## Use cases

| Scenario | How MandateSeal helps |
|---|---|
| **AI coding agent with a $10/day OpenAI budget** | `maxCostPerActionUsd: 0.50`, daily budget enforced (v0.6). Every paid completion is sealed. Finance gets a CSV monthly. |
| **Autonomous research agent calling third-party APIs** | `allowedDomains` whitelist. Agent attempting `unknown-api.com` is blocked at the wire, not at the model layer. |
| **Customer-support bot that can send emails** | `send_email` in `approvalRequiredActions`. Bot drafts; human clicks Approve in dashboard (v0.2 queue). |
| **Treasury agent that signs transactions** | `wallet_transfer` blocked by default. Specific signed mandate change required to unblock — itself logged as a receipt. |
| **Multi-tenant SaaS adding "AI mode"** | One agent per tenant; per-tenant mandate. Customers see exactly what their AI did via per-receipt links (v0.5 Public Explorer). |
| **Compliance audit ("what did the AI do on 2026-05-27?")** | Filter receipt archive by date + agent + decision. Every BLOCKED is preserved with the rule that fired (v0.4). |

---

## Project structure

```
mandateseal/
├── prisma/
│   ├── schema.prisma          # Agent · Mandate · Receipt · Approval
│   └── seed.ts                # default Atlas-01 + research-budget-v1
├── public/
│   ├── favicon.svg            # nested-diamond mark (ink bg)
│   └── mandateseal-mark.svg   # nested-diamond mark (transparent)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/route.ts                       # GET, POST (+seeds mandate)
│   │   │   ├── agents/[id]/route.ts                  # GET, DELETE (cascades)
│   │   │   ├── agents/[id]/rotate-key/route.ts       # POST — new key, invalidate old
│   │   │   ├── mandates/route.ts                     # GET, POST
│   │   │   ├── mandates/[id]/route.ts                # GET, PATCH, DELETE
│   │   │   ├── check/route.ts                        # POST — bearer auth, the wire contract
│   │   │   ├── receipts/route.ts                     # GET, POST
│   │   │   ├── verify/route.ts                       # POST — recompute + Ed25519 verify
│   │   │   ├── key.pub/route.ts                      # GET — public key PEM
│   │   │   ├── approvals/route.ts                    # GET — queue
│   │   │   ├── approvals/[id]/route.ts               # GET — one approval
│   │   │   ├── approvals/[id]/approve/route.ts       # POST — admin decision
│   │   │   ├── approvals/[id]/deny/route.ts          # POST — admin decision
│   │   │   ├── approvals/[id]/wait/route.ts          # GET — long-poll for SDK
│   │   │   ├── auth/login/route.ts                   # POST — set session cookie
│   │   │   ├── auth/logout/route.ts                  # POST — clear session
│   │   │   ├── audit/integrity/route.ts              # GET — re-verify all receipts
│   │   │   ├── audit/stats/route.ts                  # GET — decision / rule / agent aggregates
│   │   │   ├── audit/spend/route.ts                  # GET — per-agent daily/weekly/monthly spend
│   │   │   ├── tools/route.ts                        # v0.7 — GET, POST
│   │   │   ├── tools/[id]/route.ts                   # v0.7 — GET, PATCH, DELETE
│   │   │   ├── proxy/[tool]/route.ts                 # v0.7 — bearer-authed forwarder, seals receipt
│   │   │   ├── webhooks/route.ts                     # v0.8 — GET, POST
│   │   │   ├── webhooks/[id]/route.ts                # v0.8 — GET, PATCH, DELETE
│   │   │   ├── webhooks/[id]/deliveries/route.ts     # v0.8 — recent delivery log
│   │   │   ├── anchor/route.ts                       # v0.9 — GET (list batches), POST (seal)
│   │   │   ├── anchor/proof/route.ts                 # v0.9 — GET — sibling-path proof
│   │   │   ├── anchor/verify/route.ts                # v0.9 — POST — standalone verify (public)
│   │   │   └── anchor/audit/route.ts                 # v0.9 — GET — recompute every root + chain audit
│   │   ├── dashboard/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── mandates/page.tsx
│   │   ├── receipts/page.tsx
│   │   ├── approvals/page.tsx
│   │   ├── audit/page.tsx                             # integrity + analytics
│   │   ├── spend/page.tsx                             # v0.6 — budget burn
│   │   ├── tools/page.tsx                             # v0.7 — tool registry UI
│   │   ├── webhooks/page.tsx                          # v0.8 — webhook subscriptions + delivery log
│   │   ├── anchor/page.tsx                            # v0.9 — merkle batch sealer + chain audit
│   │   ├── verify/page.tsx
│   │   ├── docs/page.tsx
│   │   ├── login/page.tsx
│   │   ├── r/[id]/page.tsx                            # public receipt with OG meta
│   │   ├── a/[id]/page.tsx                            # public agent profile
│   │   ├── layout.tsx
│   │   ├── page.tsx                                  # landing
│   │   └── globals.css
│   ├── middleware.ts                                 # admin-auth gate for dashboard + admin API
│   ├── components/
│   │   ├── NavBar.tsx · Footer.tsx · LogoutButton.tsx · LoginForm.tsx
│   │   ├── AgentProfile.tsx · AgentRow.tsx
│   │   ├── MandateBuilder.tsx · ActionSimulator.tsx · TagListEditor.tsx
│   │   ├── DecisionCard.tsx · ReceiptCard.tsx · ReceiptTable.tsx
│   │   ├── ApprovalRow.tsx · IntegrityCard.tsx · ToolsClient.tsx · WebhooksClient.tsx · AnchorClient.tsx
│   │   ├── ReceiptsFilterBar.tsx · Pagination.tsx · StatTile.tsx
│   │   ├── StampBadge.tsx · HashText.tsx
│   │   ├── DashboardClient.tsx · VerifyClient.tsx
│   ├── lib/
│   │   ├── db.ts              # Prisma singleton
│   │   ├── policy.ts          # 10-rule engine
│   │   ├── crypto.ts          # Ed25519 sign/verify, sha256, key loader
│   │   ├── canonical.ts       # deterministic JSON
│   │   ├── schemas.ts         # Zod validators
│   │   ├── auth.ts            # bearer → agent
│   │   ├── admin-auth.ts      # cookie session (Edge-compatible Web Crypto)
│   │   ├── receipt.ts         # evaluateAndSeal + recomputeAndVerify + reEvaluateFromSnapshot
│   │   ├── receipt-filter.ts  # Zod filter parse + Prisma where translation
│   │   ├── approval.ts        # workflow + TTL + decideApproval helper
│   │   ├── audit.ts           # computeAuditStats (groupBy aggregates)
│   │   ├── spend.ts           # v0.6 — startOfTodayUtc + enforceDailyBudget + listAgentSpend
│   │   ├── tool.ts            # v0.7 — Zod schemas + publicTool serializer
│   │   ├── webhook.ts         # v0.8 — Webhook + Delivery schemas + emit() dispatcher (Ed25519, retry/backoff)
│   │   ├── merkle.ts          # v0.9 — pure SHA-256 merkle: buildRoot, buildProof, verifyProof
│   │   ├── anchor.ts          # v0.9 — sealNextBatch + buildAnchorProof + auditAnchorChain
│   │   ├── mandate.ts         # snapshot + serialize helpers
│   │   ├── serialize.ts       # publicAgent / publicMandate / publicReceipt
│   │   ├── constants.ts       # default agent + mandate
│   │   └── fmt.ts             # deterministic UTC timestamp
│   └── sdk/
│       ├── mandateseal.ts     # zero-dep TS SDK (check, seal, verify, guard, waitForApproval)
│       └── index.ts           # barrel re-exports for clean imports
├── bin/
│   └── mandateseal.mjs        # CLI: verify · tail · check · gen-keys · pubkey
├── vitest.config.ts           # 86 unit tests across canonical, policy, crypto, filter, spend, tool, webhook, merkle
└── docs/
    ├── ROADMAP.md
    └── asset-prompts.md       # internal brand reference
```

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 App Router | Single runtime for UI + API, server components, file-based routing |
| Language | TypeScript (strict) | Type-safe wire contracts edge to edge |
| DB | SQLite via Prisma (dev) → Postgres (prod) | Zero-config locally; switch schema provider + `DATABASE_URL` for production |
| Schema validation | Zod | One source of truth for body shapes + API + SDK |
| Crypto | Node `crypto` (Ed25519 sign/verify, SHA-256) | Asymmetric receipts since v0.1 GA; HMAC-SHA256 only for admin session cookies |
| Styling | Tailwind + hand-tuned `globals.css` | Editorial, brutalist palette — off-black + warm paper |
| Auth | Bearer API key (raw shown once, SHA-256 stored) | Simple for v0.1; rotation/revocation in roadmap |

**Zero runtime dependencies beyond:** `@prisma/client`, `next`, `react`, `react-dom`, `zod`.

---

## Out of scope (current MVP)

These are **deliberate omissions** in v0.1 — see [docs/ROADMAP.md](docs/ROADMAP.md) for where each lands:

- ✅ **Daily budget enforcement** — hard-cap rule: `sumApprovedToday + this.cost > dailyBudgetUsd` → BLOCKED; `/spend` shows per-agent burn
- ✅ **Human approval queue** — `/approvals` page + `Approval` model + long-poll endpoint
- ✅ **Asymmetric signatures** — Ed25519, public key at `/api/key.pub`
- ✅ **Dashboard auth** — Sign-In with Ethereum (EIP-4361); env allowlist (`MANDATESEAL_ADMIN_ADDRESSES`); cookie session; middleware enforces
- ❌ **API key revocation list** — rotation and delete exist, but no audit-trail of revoked keys yet
- ❌ **Multi-user RBAC** — single shared address allowlist (v0.2)
- ❌ **Rate-limiting on `/api/check`** — none (v0.7)
- ❌ **Webhooks / push notifications** — poll only (v0.8)
- ❌ **Multi-tenant / org isolation** — single global namespace (v0.3)
- ❌ **Onchain anchoring** — no merkle roots on Base yet (v0.9)
- 🟡 **Test suite** — 86 Vitest unit tests covering canonical JSON, 10-rule policy engine, Ed25519 sign/verify + tamper, receipt filter, daily-budget enforcement, tool schemas, webhook schemas, merkle tree (build/proof/tamper); API route integration tests deferred

---

## Roadmap

MandateSeal is built as a maturity journey, not a feature checklist.

Status labels:

- **Implemented**: feature exists in the codebase.
- **Beta**: usable, but still needs polish, testing, or security review.
- **Experimental**: prototype exists, but not ready for broad usage.
- **Planned**: not built yet or reserved for production hardening.

| Version | Name | Status |
|---|---|---|
| **v0.1** | Agent Action Gateway | Implemented |
| **v0.2** | Human Approval Queue | Implemented |
| **v0.3** | Developer SDK And CLI | Implemented |
| **v0.4** | Audit Log And Receipt History | Implemented |
| **v0.5** | Public Receipt Explorer | Beta |
| **v0.6** | Spend Ledger | Beta |
| **v0.7** | Tool Gateway | Experimental |
| **v0.8** | Webhooks | Experimental |
| **v0.9** | Receipt Anchors | Experimental |
| **v1.0** | Production Hardening | Planned |

### Maturity stages

> **Stage 1 - Agent safety layer (v0.1-v0.4)**: mandates, preflight checks, signed receipts, approval queue, SDK, CLI, audit log.
>
> **Stage 2 - Agent operations layer (v0.5-v0.6)**: public receipt explorer, receipt history, verification, exports, and spend control.
>
> **Stage 3 - Developer infrastructure (v0.7-v0.8)**: tool gateway between agents and APIs, webhooks for downstream systems, and future framework integrations.
>
> **Stage 4 - Public proof layer (v0.9)**: public receipt proof, merkle anchors, and onchain verification preparation.
>
> **Stage 5 - Production trust infrastructure (v1.0)**: reliability, security, tests, docs, deployment, privacy redaction, API stability, rate limits, and database migration.

Full details: [docs/ROADMAP.md](docs/ROADMAP.md).

### Not yet

MandateSeal is not launching these yet:

- Token
- Onchain payments
- Multi-chain proof
- Public marketplace
- Enterprise SSO
- Full MCP marketplace
- AI risk scoring model

Core agent action accountability comes first.

---

## Production deploy

Local dev (`npm run dev`) and local production (`npm run start`) both work out of the box. For a real deploy (Vercel, Fly, Docker, bare-metal Node), there are five things you must do — getting any of them wrong silently breaks the trust contract.

### 1 · Set env vars at the platform (not `.env`)
```bash
DATABASE_URL=postgresql://...                           # not SQLite for multi-instance
MANDATESEAL_PRIVATE_KEY_B64=<base64 of PEM>             # required — never auto-generate in prod
MANDATESEAL_PUBLIC_KEY_B64=<base64 of PEM>              # required — exposed at /api/key.pub
MANDATESEAL_ADMIN_ADDRESSES=0xAbc...,0xDef...           # required — or dashboard is open
MANDATESEAL_SESSION_SECRET=<≥8 chars random>            # session cookie HMAC
MANDATESEAL_BASE_URL=https://your.app                   # used by SDK + share links
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<wc-project-id>    # optional — for mobile / WC wallets
```

Generate keys once: `npm run cli -- gen-keys`. Save both base64 outputs in your platform's secret store.

### 2 · Postgres (recommended: Supabase free, or any managed Postgres)

The default `prisma/schema.prisma` uses Postgres. Local dev can run against Supabase / Neon / managed PG / self-hosted PG — all that matters is the connection string.

**Supabase setup**:
1. `supabase.com` → New project → choose region → set DB password (alphanumeric only, avoid `@` `#` `$` `?` — they break Prisma URL parsing)
2. Settings → Database → **Connect** → ORM → Prisma → copy both URLs
3. Paste into `.env`:
   ```
   DATABASE_URL="postgresql://postgres.<ref>:<pass>@<region>.pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.<ref>:<pass>@<region>.pooler.supabase.com:5432/postgres"
   ```
4. `npx prisma migrate deploy` (production) or `npx prisma migrate dev` (development) — applies the bundled migrations to your Postgres
5. `npx tsx prisma/seed.ts` — seeds the demo agent + mandate

Why both URLs: `DATABASE_URL` uses Supabase's transaction-mode pooler (6543) — fast for application queries. `DIRECT_URL` uses session-mode pooler (5432) — Prisma migrations need session mode to take advisory locks.

### 2b · Migration workflow

```bash
# Dev — schema change → migration file generated + applied locally
npx prisma migrate dev --name <change-description>

# Prod — apply pending migrations to the prod DB
npx prisma migrate deploy

# Inspect what would change without applying
npx prisma migrate status
```

Migrations live in `prisma/migrations/` — commit them to git. Never edit applied migration SQL after the fact; create a new migration.

### 2c · Backups

**Supabase free tier**: automatic daily backups for the last 7 days (Dashboard → Database → Backups). Sufficient for early beta but no point-in-time recovery until you upgrade to Pro ($25/mo for PITR).

**Manual backup with pg_dump** (works on any Postgres, sets up zero-cost off-site redundancy):

```bash
# Snapshot to local file
pg_dump "$DIRECT_URL" > "backup-$(date +%F).sql"

# Restore
psql "$DIRECT_URL" < backup-2026-05-28.sql

# Daily cron (Linux) — example, run on a separate box from the DB host
0 3 * * *  pg_dump "$DIRECT_URL" | gzip > "/backups/mandateseal-$(date +\%F).sql.gz"
```

For real production: `pg_dump` daily + rsync to Backblaze B2 / S3 / another VPS. Keep at least 30 days of dailies + 12 months of monthlies.

### 3 · **Never** deploy `.mandateseal-keys.json`
This file is auto-generated in dev for convenience. It's in `.gitignore` for a reason. If it ships to production:
- container restart → fresh keypair → every previously sealed receipt becomes unverifiable
- public key at `/api/key.pub` drifts mid-flight → external verifiers cache stale keys
Set env vars explicitly. Verify on first deploy that `node --env-file=.env npm run cli -- pubkey` matches what you intended.

### 4 · Long-lived Node only for retries
Webhook delivery retries (v0.8) and SDK approval long-polls run **in-process** with up to 30 s of sleep. Serverless functions (Vercel free, Cloudflare Workers) can be killed before retries finish — deliveries stuck `pending` forever. Solutions:
- run on long-lived Node (Fly, Render, Railway, bare VPS)
- OR wait for v1.0 sweeper cron / queue-based delivery worker

### 5 · Pre-launch checklist
- [ ] `npm run build` exits 0
- [ ] `npm test` — 86 unit tests pass
- [ ] Demo data reset: run `npx prisma migrate reset --force` against the prod DB if you want a fresh state (this **destroys** all data — don't run on a DB that already has real receipts)
- [ ] Don't ship the seeded Atlas-01 demo key to real users (rotate via `/agents → Rotate Key` or delete and re-create)
- [ ] `MANDATESEAL_ADMIN_ADDRESSES` set; `/dashboard` returns 307 → `/login` without cookie
- [ ] `MANDATESEAL_PRIVATE_KEY_B64` set; `/api/key.pub` returns the EXPECTED public key
- [ ] `.mandateseal-keys.json` not in container image (`docker history | grep`)
- [ ] `.env` not in container image; secrets injected at runtime
- [ ] `DATABASE_URL` + `DIRECT_URL` injected at runtime (not in image)
- [ ] `prisma/migrations/` directory committed to git and present in image
- [ ] `npx prisma migrate deploy` runs once before the app starts (post-deploy hook)
- [ ] HTTPS terminated in front of Node (nginx / Caddy / platform-provided)
- [ ] `MANDATESEAL_BASE_URL` matches your https domain
- [ ] Receipt smoke test: `curl -X POST $URL/api/check -H "Authorization: Bearer $KEY" ...` returns sealed receipt

### Recommended platforms

| Need | Pick |
|---|---|
| Live beta — free | **Render free** + Supabase free Postgres. `render.yaml` ships in the repo |
| Live beta — no cold starts | Render Starter ($7/mo) + Supabase free |
| Production hardening | bare VPS + nginx + systemd + managed Postgres (DigitalOcean, RDS) |
| Serverless | ⚠ skip Vercel/Cloudflare Workers until v1.0 retry sweeper lands |

### Deploy to Render (10 minutes)

This repo ships a `render.yaml` blueprint. Steps:

1. **Push repo to GitHub** (if not already): `git push origin main`
2. **Sign up Render** at https://render.com — connect with GitHub
3. **Dashboard → New → Blueprint** → pick your mandateseal repo → Render reads `render.yaml`, proposes one web service
4. **Set environment variables** in the dashboard (Render won't prompt for `sync: false` vars on first deploy — you set them after):
   - `DATABASE_URL` — Supabase pooler URL (port 6543)
   - `DIRECT_URL` — Supabase session URL (port 5432)
   - `MANDATESEAL_PRIVATE_KEY_B64` — generated via `npm run cli -- gen-keys`
   - `MANDATESEAL_PUBLIC_KEY_B64` — same source
   - `MANDATESEAL_ADMIN_ADDRESSES` — comma-separated 0x-addresses (wallets) allowed to sign in
   - `MANDATESEAL_SESSION_SECRET` — 32+ chars random
   - `MANDATESEAL_BASE_URL` — your `https://<name>.onrender.com` URL
5. **Deploy**. Render runs the build, which includes `prisma migrate deploy` — your Supabase DB picks up any new migrations automatically
6. **Smoke test**: visit `https://<your-name>.onrender.com` — landing should render. `curl https://<your-name>.onrender.com/api/key.pub` should return your Ed25519 PEM
7. **First-time seed** (if Supabase is empty): SSH into Render shell OR run locally with prod env: `DATABASE_URL=<prod> DIRECT_URL=<prod> npx tsx prisma/seed.ts` — grabs the demo API key once

After this, every `git push origin main` triggers an auto-deploy + migration apply.

---

## Philosophy

> **Approve before. Prove after.**

Most "AI safety" tooling is a heroic prompt and a regret log. MandateSeal pulls that into two cleaner halves: a contract that runs *before* the action, and a receipt that survives *after*. Neither half trusts the model. Both halves are inspectable by a human, a regulator, a customer.

The product is not the dashboard. The product is the receipt — a small, signed, canonical artifact that says **"on this date, this agent tried this thing, the mandate said X, here is the proof."** Everything else is delivery.

---

## License

TBD. The MVP code is hand-written and not yet open-sourced.
