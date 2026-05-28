# MandateSeal Roadmap

MandateSeal is the permission and proof layer for autonomous crypto agents.

It sits between an agent and the chain. Before any onchain action runs, the
agent presents the action to MandateSeal; the mandate engine returns a signed
decision; receipts are merkle-batched and anchored to Base so anyone can
verify what the agent was allowed to do without trusting MandateSeal.

Status labels:

- Implemented: feature exists in the codebase.
- Beta: usable, but still needs polish, testing, or security review.
- Experimental: prototype exists, but not ready for broad usage.
- Planned: not built yet.

---

## v0.1 — Agent Gateway

Status: Implemented

Core preflight loop.

- Agents, mandates, `POST /api/check` returning APPROVED / BLOCKED / NEEDS_APPROVAL
- Ed25519-signed receipts, public key at `/api/key.pub`
- Verify receipts standalone against the public key

## v0.2 — Wallet Mandates

Status: Implemented

Crypto-native mandate shape.

- `agentWallet` + `ownerWallet` per mandate
- `allowedChains`, `allowedTokens`, `allowedContracts`, `blockedContracts`, `blockedRecipients`
- `maxTxValueUsd`, `dailyTokenSpendUsd`
- `requireApprovalForSwaps`, `requireApprovalForTransfers`
- Crypto action types: `transfer_usdc`, `token_swap`, `contract_call`, `token_approval`, `bridge_transfer`, `nft_purchase`, `dao_vote`
- Crypto policy rules: blocked-recipient, blocked-contract, unsupported-chain, unsupported-token, tx-value-cap, infinite-approval, unknown-selector, swap-requires-approval, transfer-requires-approval

## v0.3 — Crypto Action Simulator

Status: Implemented

Operator can preview decisions without sending real tx.

- Dashboard simulator presets for transfer, swap, approval, contract call, bridge, DAO vote
- `/playground` public demo runs the full crypto agent script in-memory

## v0.4 — Public Receipt Explorer

Status: Implemented

Receipts are shareable proof artifacts.

- `/r/[id]` public proof page with redaction; full verify still works via `/api/verify` + id
- `/a/[id]` public agent activity page with reputation score + recent receipts
- **Dynamic 1200×630 OG image** per receipt (decision pill + action + reason + agent + hash) — shared links render as proper social previews on Twitter, Farcaster, Telegram, Discord
- **Embed view** via `?embed=1` — chrome-light iframe-friendly card with verified pill, copy-paste iframe snippet on the full page
- **Share toolbar** — Download PNG (points at the OG image route), Tweet intent, Farcaster cast intent
- **Field-level public/private controls** — `Mandate.publicFields` is a per-mandate allowlist; null = built-in defaults, explicit array opts each field in. Operator edits via MandateBuilder. Proof-grade fields (id, hashes, signature, decision, timestamp) are always public so the receipt stays verifiable.

Remaining (minor):

- Locally-rendered copy-as-image (current Download PNG is server-rendered — fine for most cases, but a client canvas path would work offline)
- Per-field UI affordance — currently a free-text TagListEditor; a checkbox grid would be friendlier

## v0.5 — Onchain Anchors

Status: Implemented

Receipts get tamper-evident external proof.

- Receipts bundled into merkle batches with prev-root hash chain
- Each batch broadcast to Base / Base Sepolia as the calldata of a 0-value self-tx (MS01 format)
- `/api/anchor/:id/verify-onchain` fetches tx, decodes calldata, confirms it matches DB
- Anchor explorer UX (per-batch detail page) planned

## v0.6 — Agent Reputation

Status: Implemented

Receipt history becomes a public asset.

- Pure reputation calculator: `calculateReputation(stats) → { score, tier, breakdown }`
- Score components: volume, anchored ratio, approval ratio², block penalty, longevity, recency — all surfaced in the breakdown so a third party can re-derive the score
- Tier labels: TRUSTED (80+) · ACTIVE (60+) · EMERGING (30+) · NEW
- Public endpoint `GET /api/agents/:id/reputation` — no auth, anyone can pull
- `/a/[id]` public agent page now leads with reputation panel + breakdown + ratios
- `/agents` dashboard adds a reputation column linking to the public page

Remaining:

- Wallet-keyed aggregation across agents that share an `agentWallet`
- Stake / slash mechanics (deferred to v1.0 Protocol Layer)
- Per-mandate trust scores (today reputation is per-agent only)

## v0.7 — Developer SDK

Status: Implemented

- `MandateSeal.check()` and `MandateSeal.guard(action, fn)` (preflight wrap)
- Zero-dependency, browser + Node
- `examples/research-agent/` reference implementation

## v0.8 — Tool / MCP Gateway

Status: Beta

Route agent tool calls through policy AND seal the result.

- Tool registry, HTTP proxy via `/api/proxy/:tool`
- Preflight receipt before forwarding (existing v0.7)
- **Outcome receipt after the upstream returns** — second sealed receipt
  with `preflightReceiptId`, `upstreamStatus`, `upstreamDurationMs`,
  `upstreamBytesIn`, `upstreamBytesOut`, `upstreamBodyHash` (sha256 of
  response body). Closes the "Prove after" half of the lifecycle.
- Both receipts are independently Ed25519-signed and merkle-anchored.

Remaining:

- MCP server adapter — expose MandateSeal as an MCP endpoint so Claude
  and other agent frameworks plug in directly (no SDK wrap needed)
- Tool quotas / per-tool rate limits separate from per-agent
- Replay protection (idempotency keys on tool calls)

## v1.0 — Protocol Layer

Status: Planned

MandateSeal as a public protocol rather than a hosted service.

- Multi-tenant workspaces with onchain-signed admin
- Public mandate registry — agents pull their policy from a known chain location
- Anchor-batch proof verification implemented in a Solidity contract for direct onchain consumption
- Token economics, governance — deferred until v1.0 ships and product-market-fit is observable

---

## Current Status Summary

| Version | Name                       | Status        |
|---------|----------------------------|---------------|
| v0.1    | Agent Gateway              | Implemented   |
| v0.2    | Wallet Mandates            | Implemented   |
| v0.3    | Crypto Action Simulator    | Implemented   |
| v0.4    | Public Receipt Explorer    | Implemented   |
| v0.5    | Onchain Anchors            | Implemented   |
| v0.6    | Agent Reputation           | Implemented   |
| v0.7    | Developer SDK              | Implemented   |
| v0.8    | Tool / MCP Gateway         | Beta          |
| v1.0    | Protocol Layer             | Planned       |

---

## Not yet

- Token / coin launch
- Real wallet transaction execution from MandateSeal itself (caller still signs and broadcasts)
- Smart contract deployment from the gateway

These are explicitly deferred until the protocol layer has visible adoption.
