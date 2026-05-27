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

Status: Beta

Receipts as shareable proof artifacts.

- `/r/[id]` public proof page with redacted payload
- `/a/[id]` public agent activity page
- Embed cards, copy-as-image, field-level public/private controls planned

## v0.5 — Onchain Anchors

Status: Implemented

Receipts get tamper-evident external proof.

- Receipts bundled into merkle batches with prev-root hash chain
- Each batch broadcast to Base / Base Sepolia as the calldata of a 0-value self-tx (MS01 format)
- `/api/anchor/:id/verify-onchain` fetches tx, decodes calldata, confirms it matches DB
- Anchor explorer UX (per-batch detail page) planned

## v0.6 — Agent Reputation

Status: Planned

Wallet-keyed history becomes an asset.

- Reputation score per `agentWallet` (clean history, deny rate, total verified actions, anchored count)
- Public agent registry (anyone can look up a wallet's MandateSeal history)
- Stake → boost reputation, slash on denied actions or post-incident challenges

## v0.7 — Developer SDK

Status: Implemented

- `MandateSeal.check()` and `MandateSeal.guard(action, fn)` (preflight wrap)
- Zero-dependency, browser + Node
- `examples/research-agent/` reference implementation

## v0.8 — Tool / MCP Gateway

Status: Experimental

Route agent tool calls through policy.

- Tool registry, HTTP proxy via `/api/proxy/:tool`
- MCP server adapter — make MandateSeal an MCP endpoint so Claude/agent frameworks plug in directly
- Post-execution outcome receipts (v0.7.1) — close the preflight-only gap

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
| v0.4    | Public Receipt Explorer    | Beta          |
| v0.5    | Onchain Anchors            | Implemented   |
| v0.6    | Agent Reputation           | Planned       |
| v0.7    | Developer SDK              | Implemented   |
| v0.8    | Tool / MCP Gateway         | Experimental  |
| v1.0    | Protocol Layer             | Planned       |

---

## Not yet

- Token / coin launch
- Real wallet transaction execution from MandateSeal itself (caller still signs and broadcasts)
- Smart contract deployment from the gateway

These are explicitly deferred until the protocol layer has visible adoption.
