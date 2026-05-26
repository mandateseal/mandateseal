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
        │                  └─ sign receipt      (canonical JSON + HMAC-SHA256)
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
| **Prove after** | Post-action | Same call seals a receipt: canonical JSON of mandate + action + decision, SHA-256 hashed, HMAC-SHA256 signed. | Tamper-evident `receipt` anyone can later verify |

A single API call covers both halves. The agent doesn't need to call MandateSeal twice.

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
  "signature": "hmac-sha256(receiptHash, signing_secret)",
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
│      └─ recomputes canonical hash + HMAC signature                       │
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
```bash
npm install              # also runs prisma generate
npm run db:push          # creates SQLite dev.db with all tables
npm run db:seed          # creates Atlas-01 + research-budget-v1, prints demo API key
npm run dev              # starts Next.js on http://localhost:3000
```

The seed script prints a demo API key to your terminal **once**. Copy it.

### .env
```
DATABASE_URL="file:./dev.db"
MANDATESEAL_SIGNING_SECRET="change-me-to-a-long-random-string"
```

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
signature    = hmac-sha256(canonical(receipt INCLUDING receiptHash, MINUS signature), MANDATESEAL_SIGNING_SECRET)
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
    "signature does not match expected HMAC-SHA256"
  ]
}
```

### Current crypto (v0.1)
HMAC-SHA256 — **symmetric**. Anyone with the signing secret can forge receipts.

### Next crypto (v0.1 GA)
Ed25519 — **asymmetric**. MandateSeal signs with the private key; the public key is exposed at `/agents/:id/key.pem`. Anyone can verify without ever touching the secret. This is the prerequisite for v0.5 (Public Receipt Explorer) and v0.9 (Onchain Anchors).

---

## API reference

All routes live under [`src/app/api/`](src/app/api/). All require `content-type: application/json` on POST/PATCH.

### Agents

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `GET` | `/api/agents` | none | — | `{ agents: [...] }` |
| `POST` | `/api/agents` | none | `{ name, role }` | `{ agent, apiKey }` — **`apiKey` shown once** |

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
| `GET` | `/api/receipts?agentId=X&limit=N` | none | — | `{ receipts: [...] }` |
| `POST` | `/api/receipts` | none | action | `{ receipt }` — same engine as `/api/check` but unauth (dashboard simulator path) |

### Verify

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| `POST` | `/api/verify` | none | `{ id }` or full receipt JSON | `{ valid, reasons, receipt? }` |

> ⚠ Dashboard auth is on the roadmap (v0.1 GA). Don't expose a public MandateSeal instance to the open internet until then.

---

## TypeScript SDK

[`src/sdk/mandateseal.ts`](src/sdk/mandateseal.ts) — zero-dependency, browser + Node compatible.

```ts
import { MandateSeal } from "./sdk/mandateseal";

const seal = new MandateSeal({
  apiKey: process.env.MANDATESEAL_API_KEY!,
  baseUrl: "http://localhost:3000",
});

// preflight + seal
const result = await seal.check({
  agentId: "agent_atlas_01",
  actionType: "paid_api_call",
  tool: "paid_api_call",
  target: "https://api.openai.com/v1/responses",
  costUsd: 0.02,
});

if (result.decision !== "APPROVED") {
  throw new Error(result.reason);
}

// ... agent runs the action ...

// third-party verification later
const proof = await seal.verifyReceipt(result.receipt);
if (!proof.valid) {
  throw new Error("Receipt tampered with: " + proof.reasons.join(", "));
}

// list recent receipts
const { receipts } = await seal.listReceipts({ agentId: "agent_atlas_01", limit: 50 });
```

Methods:
- `check(action)` → `{ decision, reason, matchedRule, riskLevel, receipt }` (auth)
- `createReceipt(action)` → `{ receipt }` (unauth, dashboard parity)
- `verifyReceipt(receipt | { id })` → `{ valid, reasons }`
- `listReceipts({ agentId?, limit? })` → `{ receipts }`

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
- `/agents` — registry
- `/mandates` — all mandates with field summaries
- `/receipts` — global archive across all agents
- `/verify` — paste a receipt JSON or enter an ID to verify
- `/roadmap` — versioned plan of record (`v0.1` through `v0.9`)
- `/docs` — quickstart

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
│   ├── schema.prisma          # Agent · Mandate · Receipt
│   └── seed.ts                # default Atlas-01 + research-budget-v1
├── public/
│   ├── favicon.svg            # nested-diamond mark (ink bg)
│   └── mandateseal-mark.svg   # nested-diamond mark (transparent)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agents/route.ts
│   │   │   ├── mandates/route.ts
│   │   │   ├── mandates/[id]/route.ts
│   │   │   ├── check/route.ts
│   │   │   ├── receipts/route.ts
│   │   │   └── verify/route.ts
│   │   ├── dashboard/page.tsx
│   │   ├── agents/page.tsx
│   │   ├── mandates/page.tsx
│   │   ├── receipts/page.tsx
│   │   ├── verify/page.tsx
│   │   ├── roadmap/page.tsx
│   │   ├── docs/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx           # landing
│   │   └── globals.css
│   ├── components/
│   │   ├── NavBar.tsx · Footer.tsx
│   │   ├── AgentProfile.tsx · MandateBuilder.tsx · ActionSimulator.tsx
│   │   ├── DecisionCard.tsx · ReceiptCard.tsx · ReceiptTable.tsx
│   │   ├── StampBadge.tsx · HashText.tsx · TagListEditor.tsx
│   │   ├── DashboardClient.tsx · VerifyClient.tsx
│   ├── lib/
│   │   ├── db.ts              # Prisma singleton
│   │   ├── policy.ts          # 10-rule engine
│   │   ├── crypto.ts          # sha256, HMAC, key gen
│   │   ├── canonical.ts       # deterministic JSON
│   │   ├── schemas.ts         # Zod validators
│   │   ├── auth.ts            # bearer → agent
│   │   ├── receipt.ts         # evaluateAndSeal + recomputeAndVerify
│   │   ├── mandate.ts         # snapshot + serialize helpers
│   │   ├── serialize.ts       # publicAgent / publicMandate / publicReceipt
│   │   ├── constants.ts       # default agent + mandate
│   │   ├── roadmap.ts         # single source for /roadmap + docs
│   │   └── fmt.ts             # deterministic UTC timestamp
│   └── sdk/mandateseal.ts     # zero-dep TS SDK
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
| DB | SQLite via Prisma | Zero-config local; will migrate to Postgres at v0.6 |
| Schema validation | Zod | One source of truth for body shapes + API + SDK |
| Crypto | Node `crypto` (SHA-256, HMAC-SHA256) | No third-party crypto deps in MVP; Ed25519 via `crypto.sign` in v0.1 GA |
| Styling | Tailwind + hand-tuned `globals.css` | Editorial, brutalist palette — off-black + warm paper |
| Auth | Bearer API key (raw shown once, SHA-256 stored) | Simple for v0.1; rotation/revocation in roadmap |

**Zero runtime dependencies beyond:** `@prisma/client`, `next`, `react`, `react-dom`, `zod`.

---

## Out of scope (current MVP)

These are **deliberate omissions** in v0.1 — see [docs/ROADMAP.md](docs/ROADMAP.md) for where each lands:

- ❌ **Daily budget enforcement** — `dailyBudgetUsd` is stored but not aggregated (v0.6)
- ❌ **Human approval queue** — `NEEDS_APPROVAL` is a stamp, not a workflow (v0.2)
- ❌ **Asymmetric signatures** — HMAC-SHA256 today (Ed25519 in v0.1 GA)
- ❌ **Dashboard auth** — anyone on `localhost:3000` can edit (v0.1 GA)
- ❌ **API key rotation/revocation** — no rotation endpoint and no agent-delete endpoint (v0.1 GA)
- ❌ **Rate-limiting on `/api/check`** — none (v0.7)
- ❌ **Webhooks / push notifications** — poll only (v0.8)
- ❌ **Multi-tenant / org isolation** — single global namespace (v0.3)
- ❌ **Onchain anchoring** — no merkle roots on Base yet (v0.9)
- ❌ **Test suite** — manual curl smoke tests only (v0.1 GA)

---

## Roadmap

| Version | Name | Status |
|---|---|---|
| **v0.1** | Agent Action Gateway | **SHIPPED** |
| v0.2 | Human Approval Queue | next up |
| v0.3 | Developer SDK | planned |
| v0.4 | Audit Log & Receipt History | planned |
| v0.5 | Public Receipt Explorer | planned |
| v0.6 | Spend Ledger | planned |
| v0.7 | Tool Gateway | later |
| v0.8 | Webhooks | later |
| v0.9 | Onchain Anchors | later |

Full detail with goals · ships · success criteria · effort · cross-cutting concerns: [docs/ROADMAP.md](docs/ROADMAP.md) and `/roadmap` in the running app.

---

## Philosophy

> **Approve before. Prove after.**

Most "AI safety" tooling is a heroic prompt and a regret log. MandateSeal pulls that into two cleaner halves: a contract that runs *before* the action, and a receipt that survives *after*. Neither half trusts the model. Both halves are inspectable by a human, a regulator, a customer.

The product is not the dashboard. The product is the receipt — a small, signed, canonical artifact that says **"on this date, this agent tried this thing, the mandate said X, here is the proof."** Everything else is delivery.

---

## License

TBD. The MVP code is hand-written and not yet open-sourced.
