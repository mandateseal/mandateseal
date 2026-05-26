# MandateSeal — Roadmap

Status: **shipped** · **next up** · **planned** · **later**

Source of truth: [`src/lib/roadmap.ts`](../src/lib/roadmap.ts). Web view: `/roadmap`.

---

## v0.1 — Agent Action Gateway *(shipped)*

> Preflight checks, mandate rules, policy decisions, signed receipts, and receipt verification.

**Goal:** prove the core loop — every agent action passes a mandate, every decision produces a verifiable receipt.

**Ships**
- Agents, mandates, receipts persisted (SQLite + Prisma)
- `POST /api/check` with Bearer auth, 10-rule policy engine
- HMAC-SHA256 signed receipts over canonical JSON
- `/api/verify` (by id or full payload), tamper detection
- Dashboard: agent profile, mandate builder, action simulator, decision card, receipt card, archive
- TypeScript SDK skeleton (`check`, `createReceipt`, `verifyReceipt`)

**Success criteria.** A signed receipt of any decision can be independently verified by a third party without contacting MandateSeal.

**Effort.** Shipped. 2–3 days of GA cleanup remaining (Ed25519, mandate snapshot in receipt, dashboard auth).

---

## v0.2 — Human Approval Queue *(next up)*

> Turn `NEEDS_APPROVAL` into a real workflow with pending actions, approve/reject decisions, reviewer notes, and expiration windows.

**Goal:** make `NEEDS_APPROVAL` real. Today it's a sticker on a receipt; tomorrow it's a workflow humans actually clear.

**Ships**
- `Approval` model: receiptId, requestedAt, decidedAt, decidedBy, decisionNote, ttl
- `/approvals` dashboard page with diff view (action requested vs mandate rule)
- `POST /api/approvals/:id/approve|deny` with admin auth
- Long-poll endpoint so SDK can block until human decides
- TTL: pending items auto-deny after configurable timeout
- Stub Slack/email notification (full integration in v0.8)

**Success criteria.** Agent issues `buy_dataset` → SDK blocks → human clicks Approve → agent unblocks and proceeds.

**Depends on.** v0.1 GA (dashboard auth).

**Effort.** ~1 week.

---

## v0.3 — Developer SDK

> Guard agent actions with one function call. TypeScript SDK first, with `check`, `seal`, and `verify` helpers.

**Goal:** move from thin HTTP wrapper to true ergonomics.

**Ships**
- `seal.guard(action, async () => doIt())` — checks, executes only if APPROVED, blocks on approval, seals outcome
- `check` / `seal` / `verify` as the named primitives
- Framework adapters: `@mandateseal/vercel-ai`, `@mandateseal/openai-tools`, `@mandateseal/langchain`
- Python SDK with parity
- CLI: `npx mandateseal verify ./receipt.json`, `npx mandateseal tail`
- Publish to npm + PyPI

**Success criteria.** A developer drops 3 lines into an existing OpenAI tool-use loop and gets enforced spending + a receipt log.

**Depends on.** v0.1 GA.

**Effort.** ~2 weeks.

---

## v0.4 — Audit Log & Receipt History

> Searchable action history for agents, mandates, policy decisions, costs, and receipts.

**Goal:** v0.1 stores and lists raw receipts. v0.4 makes them searchable, filterable, and analyzable.

**Ships**
- Multi-dimensional filter: date range, decision, tool, action, cost band, agent
- Full-text search across reason / matchedRule / target
- Per-agent dashboards: time-series charts of decisions, blocked-rate, cost trend
- Per-mandate analytics: which rules fire most, false-positive review
- Export: CSV and JSON for finance / compliance
- Retention policies + archive-to-cold-storage
- Log integrity check (per-receipt hash already in v0.1; v0.4 adds a roll-up audit endpoint)

**Success criteria.** On-call answers *"why did agent X get blocked yesterday between 14:00–15:00"* in under 30 seconds.

**Depends on.** v0.1 GA. Postgres recommended; small datasets still fine on SQLite.

**Effort.** ~1.5 weeks.

---

## v0.5 — Public Receipt Explorer

> Share and verify autonomous action receipts with public receipt pages, proof links, and copyable verification payloads.

**Goal:** receipts become shareable artifacts. Anyone with a link can verify.

**Ships**
- Public `/r/:receiptId` page — read-only signed receipt with Verify button
- Public verifier accepts Ed25519 receipts; validates against agent's published public key
- Per-agent public profile (`/a/:agentId`): decision distribution, blocked-rate, sealed receipts
- Copy-as-image, embed iframe, OG meta for share previews
- Privacy controls: hash/redact private mandate fields and `rawPayload.metadata`

**Success criteria.** A tweet linking `mandateseal.app/r/rct_xxx` renders a verifiable proof card.

**Depends on.** v0.1 GA (Ed25519), v0.3 (SDK adoption → volume), v0.4 (internal review before public).

**Effort.** ~1.5 weeks.

---

## v0.6 — Spend Ledger

> Track daily budgets, usage, cost limits, per-agent spend, per-tool spend, and blocked spend attempts.

**Goal:** close the budget gap. `dailyBudgetUsd` is stored today but not enforced. v0.6 actually aggregates and enforces.

**Ships**
- New policy rule: `sum(today's APPROVED).cost + this.cost > dailyBudgetUsd` → `NEEDS_APPROVAL` or `BLOCKED` (configurable)
- Budget windows: daily / weekly / monthly / rolling-Nh
- Soft cap → approval, hard cap → block
- Per-tool, per-action spend breakdown
- Spend forecast: extrapolate burn rate vs window
- Finance CSV export
- Migration: SQLite → Postgres (aggregate queries demand it)

**Success criteria.** Agent gets blocked at $25.00/day cumulative, not just per-action.

**Depends on.** Postgres migration.

**Effort.** ~2 weeks.

---

## v0.7 — Tool Gateway

> MandateSeal becomes a policy layer for agent tools, function calls, MCP servers, and external APIs.

**Goal:** stop being a wrapper SDK; become the wire between agents and tools.

**Ships**
- MandateSeal as MCP (Model Context Protocol) server — agent connects to MandateSeal, MandateSeal proxies to upstream tools
- Tool registry: register once, attach mandates, all agents inherit policy
- Adapters for HTTP webhook tools, OpenAPI specs, MCP servers
- Per-tool quotas (calls/min, $/call)
- Response interception: mask/redact tool responses (PII, secrets) before they reach the agent
- Replay protection (nonce on tool calls)

**Success criteria.** Swap an agent's MCP server URL from raw tool to MandateSeal — zero code change, full audit trail.

**Depends on.** v0.6 (spend enforcement is load-bearing for a tool proxy).

**Effort.** ~3–4 weeks. The biggest version; the pivot from library to infrastructure.

---

## v0.8 — Webhooks

> Notify apps when actions are approved, blocked, require approval, executed, or sealed.

**Goal:** push instead of poll. Apps react to decisions.

**Ships**
- `Webhook` model per agent/workspace: url, secret, events
- Events: `receipt.created`, `receipt.blocked`, `approval.requested`, `approval.decided`, `budget.threshold`, `tamper.detected`
- Signed webhook payloads (same Ed25519 key as receipts), retry with exponential backoff
- Delivery log + manual replay
- Built-in integrations: Slack, Discord, PagerDuty, generic HTTP

**Success criteria.** Slack channel posts a stamp every time a HIGH-risk action is blocked.

**Depends on.** v0.2 (approval events), v0.6 (budget events).

**Effort.** ~4–5 days.

---

## v0.9 — Onchain Anchors

> Anchor receipt hashes on Base for public proof and tamper-evident external verification.

**Goal:** push past "trust the MandateSeal signing key" to "trust the chain."

**Ships**
- Batched merkle root anchored to Base (or Optimism) every N minutes
- `anchor` field per receipt: `txHash`, `blockNumber`, `merkleProof`
- Public verifier extension: independently confirm a receipt was included in an on-chain root at a specific time
- Anchor contract: dumb on purpose (`mapping(uint => bytes32) roots;`) — no off-chain trust assumption
- Gas optimization: only roots go on-chain, never per-receipt
- Optional EAS (Ethereum Attestation Service) schema for high-value receipts

**Success criteria.** A court-admissible chain of "MandateSeal said this receipt existed before 2026-XX-XX block N."

**Depends on.** Everything. The capstone.

**Effort.** ~2–3 weeks.

---

## Cross-cutting concerns

| Concern | Slot it into | Why |
|---|---|---|
| Ed25519 signatures | v0.1 GA | Unblocks v0.5 (public verify) and v0.9 (onchain) |
| Dashboard auth (multi-user, RBAC) | v0.2 | First version where humans interact |
| Test suite (Vitest + Playwright) | v0.1 GA | Everything after assumes a regression net |
| Multi-tenant (orgs / workspaces) | v0.3 | Once SDK adoption starts, isolation matters |
| Postgres migration | v0.6 | Aggregate queries force the move |
| Rate-limit on `/api/check` | v0.7 | Becomes load-bearing infra at v0.7 |
| Audit-log hash chain (merkle) | v0.9 | Natural precursor to onchain anchors |

---

## Order trade-offs worth considering

- **v0.3 before v0.2?** If acquisition is dev-led, polish the SDK before humans-in-loop. Devs adopt; teams add approval workflows when they need it.
- **v0.8 before v0.6?** Webhooks unlock integrations cheaply. Spend ledger unlocks pricing. Pick which one moves the customer needle first.
- **v0.9 is a brand bet, not a feature bet.** It's the headline that says we're serious about cryptographic accountability. Worth doing for positioning even if few customers verify the chain.
