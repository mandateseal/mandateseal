// Single source of truth for the MandateSeal roadmap.
// Both /roadmap (web) and docs/ROADMAP.md (manual mirror) render from this shape.

export type VersionStatus = "shipped" | "next" | "planned" | "later";

export interface VersionEntry {
  version: string;
  name: string;
  status: VersionStatus;
  oneLine: string;
  goal: string;
  ships: string[];
  successCriteria: string;
  dependsOn?: string;
  effort: string;
}

export interface CrossCutting {
  concern: string;
  slot: string;
  why: string;
}

export const ROADMAP: VersionEntry[] = [
  {
    version: "v0.1",
    name: "Agent Action Gateway",
    status: "shipped",
    oneLine: "Preflight checks, mandate rules, policy decisions, signed receipts, and receipt verification.",
    goal: "Prove the core loop — every agent action passes a mandate, every decision produces a verifiable receipt.",
    ships: [
      "Agents, mandates, receipts persisted (SQLite + Prisma)",
      "POST /api/check with Bearer auth, 10-rule policy engine",
      "HMAC-SHA256 signed receipts over canonical JSON",
      "/api/verify (by id or full payload), tamper detection",
      "Dashboard: agent profile, mandate builder, action simulator, decision card, receipt card, archive",
      "TypeScript SDK skeleton (check, createReceipt, verifyReceipt)",
    ],
    successCriteria:
      "A signed receipt of any decision can be independently verified by a third party without contacting MandateSeal.",
    effort: "Shipped. 2–3 days of GA cleanup remaining (Ed25519, mandate snapshot in receipt, dashboard auth).",
  },
  {
    version: "v0.2",
    name: "Human Approval Queue",
    status: "next",
    oneLine:
      "Turn NEEDS_APPROVAL into a real workflow with pending actions, approve/reject decisions, reviewer notes, and expiration windows.",
    goal: "Make NEEDS_APPROVAL real. Today it's a sticker on a receipt; tomorrow it's a workflow humans actually clear.",
    ships: [
      "Approval model: receiptId, requestedAt, decidedAt, decidedBy, decisionNote, ttl",
      "/approvals dashboard page with diff view (action requested vs mandate rule)",
      "POST /api/approvals/:id/approve|deny with admin auth",
      "Long-poll endpoint so SDK can block until human decides",
      "TTL: pending items auto-deny after configurable timeout",
      "Stub Slack/email notification (full integration in v0.8)",
    ],
    successCriteria:
      "Agent issues buy_dataset → SDK blocks → human clicks Approve in dashboard → agent unblocks and proceeds.",
    dependsOn: "v0.1 GA (dashboard auth)",
    effort: "~1 week",
  },
  {
    version: "v0.3",
    name: "Developer SDK",
    status: "planned",
    oneLine:
      "Guard agent actions with one function call. TypeScript SDK first, with check, seal, and verify helpers.",
    goal: "Move from thin HTTP wrapper to true ergonomics.",
    ships: [
      "seal.guard(action, async () => doIt()) — checks, executes only if APPROVED, blocks on approval, seals outcome",
      "check / seal / verify as the named primitives",
      "Framework adapters: @mandateseal/vercel-ai, @mandateseal/openai-tools, @mandateseal/langchain",
      "Python SDK with parity",
      "CLI: npx mandateseal verify ./receipt.json, npx mandateseal tail",
      "Publish to npm + PyPI",
    ],
    successCriteria:
      "A developer drops 3 lines into an existing OpenAI tool-use loop and gets enforced spending + a receipt log.",
    dependsOn: "v0.1 GA",
    effort: "~2 weeks (TS adapters first, Python after)",
  },
  {
    version: "v0.4",
    name: "Audit Log & Receipt History",
    status: "planned",
    oneLine:
      "Searchable action history for agents, mandates, policy decisions, costs, and receipts.",
    goal:
      "v0.1 stores and lists raw receipts. v0.4 makes them searchable, filterable, and analyzable.",
    ships: [
      "Multi-dimensional filter: date range, decision, tool, action, cost band, agent",
      "Full-text search across reason / matchedRule / target",
      "Per-agent dashboards: time-series charts of decisions, blocked-rate, cost trend",
      "Per-mandate analytics: which rules fire most, false-positive review",
      "Export: CSV and JSON for finance / compliance",
      "Retention policies + archive-to-cold-storage",
      "Log integrity check (per-receipt hash already in v0.1; v0.4 adds a roll-up audit endpoint)",
    ],
    successCriteria:
      "On-call answers \"why did agent X get blocked yesterday between 14:00–15:00\" in under 30 seconds.",
    dependsOn: "v0.1 GA (Postgres recommended; small datasets still fine on SQLite)",
    effort: "~1.5 weeks",
  },
  {
    version: "v0.5",
    name: "Public Receipt Explorer",
    status: "planned",
    oneLine:
      "Share and verify autonomous action receipts with public receipt pages, proof links, and copyable verification payloads.",
    goal: "Receipts become shareable artifacts. Anyone with a link can verify.",
    ships: [
      "Public /r/:receiptId page — read-only signed receipt with Verify button",
      "Public verifier accepts Ed25519 receipts; validates against agent's published public key",
      "Per-agent public profile (/a/:agentId): decision distribution, blocked-rate, sealed receipts",
      "Copy-as-image, embed iframe, OG meta for share previews",
      "Privacy controls: hash/redact private mandate fields and rawPayload.metadata",
    ],
    successCriteria:
      "A tweet linking mandateseal.app/r/rct_xxx renders a verifiable proof card.",
    dependsOn: "v0.1 GA (Ed25519), v0.3 (SDK adoption → volume), v0.4 (internal review before public)",
    effort: "~1.5 weeks",
  },
  {
    version: "v0.6",
    name: "Spend Ledger",
    status: "planned",
    oneLine:
      "Track daily budgets, usage, cost limits, per-agent spend, per-tool spend, and blocked spend attempts.",
    goal:
      "Close the budget gap. dailyBudgetUsd is stored today but not enforced. v0.6 actually aggregates and enforces.",
    ships: [
      "New policy rule: sum(today's APPROVED).cost + this.cost > dailyBudgetUsd → NEEDS_APPROVAL or BLOCKED (configurable)",
      "Budget windows: daily / weekly / monthly / rolling-Nh",
      "Soft cap → approval, hard cap → block",
      "Per-tool, per-action spend breakdown",
      "Spend forecast: extrapolate burn rate vs window",
      "Finance CSV export",
      "Migration: SQLite → Postgres (aggregate queries demand it)",
    ],
    successCriteria:
      "Agent gets blocked at $25.00/day cumulative, not just per-action.",
    dependsOn: "Postgres migration",
    effort: "~2 weeks",
  },
  {
    version: "v0.7",
    name: "Tool Gateway",
    status: "later",
    oneLine:
      "MandateSeal becomes a policy layer for agent tools, function calls, MCP servers, and external APIs.",
    goal: "Stop being a wrapper SDK; become the wire between agents and tools.",
    ships: [
      "MandateSeal as MCP (Model Context Protocol) server — agent connects to MandateSeal, MandateSeal proxies to upstream tools",
      "Tool registry: register once, attach mandates, all agents inherit policy",
      "Adapters for HTTP webhook tools, OpenAPI specs, MCP servers",
      "Per-tool quotas (calls/min, $/call)",
      "Response interception: mask/redact tool responses (PII, secrets) before they reach the agent",
      "Replay protection (nonce on tool calls)",
    ],
    successCriteria:
      "Swap an agent's MCP server URL from raw tool to MandateSeal — zero code change, full audit trail.",
    dependsOn: "v0.6 (spend enforcement is load-bearing for a tool proxy)",
    effort: "~3–4 weeks — the biggest version; the pivot from library to infrastructure",
  },
  {
    version: "v0.8",
    name: "Webhooks",
    status: "later",
    oneLine:
      "Notify apps when actions are approved, blocked, require approval, executed, or sealed.",
    goal: "Push instead of poll. Apps react to decisions.",
    ships: [
      "Webhook model per agent/workspace: url, secret, events",
      "Events: receipt.created, receipt.blocked, approval.requested, approval.decided, budget.threshold, tamper.detected",
      "Signed webhook payloads (same Ed25519 key as receipts), retry with exponential backoff",
      "Delivery log + manual replay",
      "Built-in integrations: Slack, Discord, PagerDuty, generic HTTP",
    ],
    successCriteria:
      "Slack channel posts a stamp every time a HIGH-risk action is blocked.",
    dependsOn: "v0.2 (approval events), v0.6 (budget events)",
    effort: "~4–5 days",
  },
  {
    version: "v0.9",
    name: "Onchain Anchors",
    status: "later",
    oneLine:
      "Anchor receipt hashes on Base for public proof and tamper-evident external verification.",
    goal: "Push past \"trust the MandateSeal signing key\" to \"trust the chain.\"",
    ships: [
      "Batched merkle root anchored to Base (or Optimism) every N minutes",
      "anchor field per receipt: txHash, blockNumber, merkleProof",
      "Public verifier extension: independently confirm a receipt was included in an on-chain root at a specific time",
      "Anchor contract: dumb on purpose (mapping(uint => bytes32) roots;) — no off-chain trust assumption",
      "Gas optimization: only roots go on-chain, never per-receipt",
      "Optional EAS (Ethereum Attestation Service) schema for high-value receipts",
    ],
    successCriteria:
      "A court-admissible chain of \"MandateSeal said this receipt existed before 2026-XX-XX block N.\"",
    dependsOn: "Everything (capstone)",
    effort: "~2–3 weeks",
  },
];

export const CROSS_CUTTING: CrossCutting[] = [
  { concern: "Ed25519 signatures", slot: "v0.1 GA", why: "Unblocks v0.5 (public verify) and v0.9 (onchain)" },
  { concern: "Dashboard auth (multi-user, RBAC)", slot: "v0.2", why: "First version where humans interact" },
  { concern: "Test suite (Vitest + Playwright)", slot: "v0.1 GA", why: "Everything after assumes a regression net" },
  { concern: "Multi-tenant (orgs / workspaces)", slot: "v0.3", why: "Once SDK adoption starts, isolation matters" },
  { concern: "Postgres migration", slot: "v0.6", why: "Aggregate queries force the move" },
  { concern: "Rate-limit on /api/check", slot: "v0.7", why: "Becomes load-bearing infra at v0.7" },
  { concern: "Audit-log hash chain (merkle)", slot: "v0.9", why: "Natural precursor to onchain anchors" },
];

export const ORDER_TRADEOFFS: { title: string; body: string }[] = [
  {
    title: "v0.3 before v0.2?",
    body: "If acquisition is dev-led, polish the SDK before humans-in-loop. Devs adopt; teams add approval workflows when they need it.",
  },
  {
    title: "v0.8 before v0.6?",
    body: "Webhooks unlock integrations cheaply. Spend ledger unlocks pricing. Pick which one moves the customer needle first.",
  },
  {
    title: "v0.9 is a brand bet, not a feature bet.",
    body: "It's the headline that says we're serious about cryptographic accountability. Worth doing for positioning even if few customers verify the chain.",
  },
];

export const STATUS_LABEL: Record<VersionStatus, string> = {
  shipped: "SHIPPED",
  next: "NEXT UP",
  planned: "PLANNED",
  later: "LATER",
};
