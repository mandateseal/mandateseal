# MandateSeal Roadmap

MandateSeal is not a dashboard-first product. It is an agent action gateway that
is growing into trust infrastructure for autonomous AI agents.

The roadmap is split into two views:

- Public roadmap: what users, developers, and early customers need to understand.
- Technical roadmap: what the product team is building and hardening.

Status labels:

- Implemented: feature exists in the codebase.
- Beta: usable, but still needs polish, testing, or security review.
- Experimental: prototype exists, but not ready for broad usage.
- Planned: not built yet or reserved for production hardening.

---

## Public Roadmap

### Phase 1 - Agent Action Control

Mandates, preflight checks, policy decisions, and signed receipts.

Users can define what an agent is allowed to do, check every action before it
runs, and generate proof for every decision.

### Phase 2 - Human Oversight

Approval queues, reviewer decisions, and safer escalation for risky actions.

Agents can continue autonomously for low-risk actions, but sensitive or costly
actions can require a human decision before execution.

### Phase 3 - Audit And Spend Control

Receipt history, audit logs, verification, exports, and budget enforcement.

Teams can inspect what agents attempted, why actions were approved or blocked,
and how much each agent is spending.

### Phase 4 - Developer Infrastructure

SDK, CLI, tool gateway, webhooks, and agent framework integrations.

Developers can plug MandateSeal into real agent apps, route tool calls through
policy, and react to signed events.

### Phase 5 - Public Proof

Public receipt explorer, merkle anchors, and onchain verification.

Receipts become shareable proof artifacts that can be verified outside the
dashboard.

---

## Technical Roadmap

### v0.1 - Agent Action Gateway

Status: Implemented

Core product loop.

Users can:

- Create agents
- Create mandates
- Run preflight checks with `POST /api/check`
- Get `APPROVED`, `BLOCKED`, or `NEEDS_APPROVAL` decisions
- Generate Ed25519-signed receipts
- Verify receipts against the public key

Main value:

MandateSeal can control agent actions before execution and produce proof after.

### v0.2 - Human Approval Queue

Status: Implemented

Turns risky actions into a real workflow.

Users can:

- See pending risky actions
- Approve or deny actions
- Add reviewer notes
- Track approval status
- Let SDK callers wait until a human resolves the action
- Expire stale approval requests

Main value:

Autonomous agents can escalate risky actions to humans without custom glue code.

### v0.3 - Developer SDK And CLI

Status: Implemented

Makes MandateSeal usable from code and terminal workflows.

Developers can:

- Use the TypeScript SDK
- Call `seal.check()`
- Call `seal.guard(action, fn)`
- Verify receipts
- Use the CLI for `verify`, `tail`, `check`, `gen-keys`, and `pubkey`

Main value:

Developers can integrate MandateSeal into an existing agent loop with minimal code.

### v0.4 - Audit Log And Receipt History

Status: Implemented

Makes every agent action searchable and reviewable.

Users can:

- Browse receipt history
- Filter by agent, tool, action, decision, risk, date, and cost
- Search reason, matched rule, target, action, and tool
- Export receipts to CSV
- Run receipt integrity checks
- View audit stats

Main value:

Teams can understand what their agents tried to do and why MandateSeal approved
or blocked each action.

### v0.5 - Public Receipt Explorer

Status: Beta

Turns receipts into shareable proof.

Users can:

- Open public receipt pages
- Verify receipt authenticity
- View public agent activity pages
- Copy receipt links
- Share action proof

Main value:

Autonomous agent actions can be proven publicly.

Remaining:

- Privacy redaction hardening
- Copy-as-image
- Embed cards
- Field-level public/private controls

### v0.6 - Spend Ledger

Status: Beta

Adds budget control for autonomous agents.

Users can:

- Track daily spend per agent
- Enforce daily budgets
- View spend history
- See blocked overspend attempts
- Monitor cost usage

Main value:

MandateSeal becomes a cost control layer for AI agents.

Remaining:

- Weekly, monthly, and rolling budget windows
- Soft caps that require approval instead of blocking
- Spend forecasting
- Postgres optimization for larger datasets

### v0.7 - Tool Gateway

Status: Experimental

MandateSeal starts sitting between agents and tools.

Developers can:

- Register HTTP tools
- Call tools through the MandateSeal proxy
- Enforce policy before tool calls
- Generate receipts for tool calls

Main value:

MandateSeal becomes infrastructure between agents and external tools.

Remaining:

- MCP server support
- OpenAPI tool adapters
- Tool quotas
- Replay protection
- Post-execution outcome receipts

### v0.8 - Webhooks

Status: Experimental

Allows other apps to react to MandateSeal events.

Developers can:

- Create webhook endpoints
- Receive signed events
- Track delivery attempts
- Get notified when receipts are created, blocked, or need approval

Main value:

MandateSeal can integrate with external systems.

Remaining:

- Manual replay
- Slack, Discord, and PagerDuty templates
- Queue-based delivery
- Production retry worker

### v0.9 - Receipt Anchors

Status: Experimental

Prepares receipts for tamper-evident external proof.

Users can:

- Batch receipt hashes
- Create merkle roots
- Verify anchor proofs
- Audit anchor chains

Main value:

MandateSeal receipts become stronger proof artifacts.

Remaining:

- Base onchain anchoring
- Transaction hash storage
- Public chain verification
- Anchor explorer UX

### v1.0 - Production Hardening

Status: Planned

v1.0 should not be a major feature release. It should make MandateSeal stable
enough for real customers.

Focus:

- Reliability
- Security
- Tests
- Docs
- Deployment
- Admin auth
- API key lifecycle
- Privacy redaction
- API stability
- Database migration path
- Rate limiting
- Multi-tenant workspace isolation

Main value:

MandateSeal becomes production-ready trust infrastructure for autonomous AI
agents.

---

## Current Status Summary

| Version | Name | Status |
|---|---|---|
| v0.1 | Agent Action Gateway | Implemented |
| v0.2 | Human Approval Queue | Implemented |
| v0.3 | Developer SDK And CLI | Implemented |
| v0.4 | Audit Log And Receipt History | Implemented |
| v0.5 | Public Receipt Explorer | Beta |
| v0.6 | Spend Ledger | Beta |
| v0.7 | Tool Gateway | Experimental |
| v0.8 | Webhooks | Experimental |
| v0.9 | Receipt Anchors | Experimental |
| v1.0 | Production Hardening | Planned |

---

## Not Yet

MandateSeal is not launching these yet:

- Token
- Onchain payments
- Multi-chain proof
- Public marketplace
- Enterprise SSO
- Full MCP marketplace
- AI risk scoring model

Reason:

Core agent action accountability comes first.

---

## Short Roadmap

MandateSeal roadmap:

1. Control agent actions
2. Add human approval
3. Make every action auditable
4. Give developers SDK and CLI
5. Route tools through policy
6. Make receipts publicly verifiable
7. Anchor proof onchain
8. Harden for production customers

Approve before. Prove after.

---

## Narrative

Do not present MandateSeal as a feature list.

Present it as a maturity journey:

- Stage 1: Agent safety layer
- Stage 2: Agent operations layer
- Stage 3: Developer infrastructure
- Stage 4: Public proof layer
- Stage 5: Production trust infrastructure

MandateSeal is moving from agent action control to agent trust infrastructure.
