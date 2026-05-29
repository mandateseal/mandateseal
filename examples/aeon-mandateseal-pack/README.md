# Aeon × MandateSeal — guarded `distribute-tokens`

A drop-in, MandateSeal-guarded variant of Aeon's `distribute-tokens` skill.

Aeon's thesis is *no approval loops, configure once, forget forever*. That's
exactly right for the 25 read-only crypto skills. But two skills move real
funds — `distribute-tokens` and `contributor-reward` (which hands off to it) —
both via the Bankr Wallet API on Base. There, "forget forever" is the one place
forgetting gets expensive: every cap is self-config (the same agent that writes
the distribution list also sets its own limits), and there's no proof of what
was authorized after the fact.

This pack keeps the autonomy and adds an external **permission + proof** layer:

- **Approve before** — each transfer passes `POST /api/check` against a mandate
  the *operator* set, before it reaches Bankr.
- **Prove after** — every decision is Ed25519-signed and merkle-anchored, so a
  contributor or auditor can verify it later.

## Files

| File | What it is |
|---|---|
| `SKILL.md` | The guarded skill — stock distribute-tokens + a GATE phase. |
| `aeon.yml` | Snippet to enable it in an Aeon agent. |
| `../aeon-distribute-guarded.mjs` | Runnable **local** demo (offline by default). |

## Run the demo (local, no funds moved)

```
node examples/aeon-distribute-guarded.mjs
```

Offline by default — it uses a faithful mirror of the real policy engine, so it
runs with zero setup. To see real signed receipts, start the app and pass a key:

```
npm run dev
MANDATESEAL_URL=http://localhost:3000 MANDATESEAL_API_KEY=msk_... \
  node examples/aeon-distribute-guarded.mjs
```

## What maps cleanly today

The mandate fields the policy engine already enforces line up with exactly what
distribute-tokens lacks an *external* check for:

| distribute-tokens (self-config) | MandateSeal guard | Rule |
|---|---|---|
| `token: USDC/ETH (Base)` | `allowedChains` + `allowedTokens` | C3 / C4 |
| no per-recipient ceiling | `maxTxValueUsd` | C5 |
| no per-day spend ceiling | `dailyTokenSpendUsd` (sums today's APPROVED `txValueUsd`) | v0.8.2 |
| no never-pay list | `blockedRecipients` | C1 |
| no approval gate | `requireApprovalForTransfers` → human queue | C9 |
| local idempotency state file | server-side `Idempotency-Key` (cross-run/host) | v0.8.1 |

## Honest gaps (what is *not* wired yet)

Founder-to-founder, so there's no overselling — two things would make the fit
even tighter, and neither is built today (a per-day transferred-value ceiling,
`dailyTokenSpendUsd`, **is** now enforced — see the table above):

1. **Recipient allow-list.** Today there's a block-list (`blockedRecipients`)
   but no allow-list. For dynamic contributor lists, block-list + per-tx cap +
   approval is arguably the right model — but an allow-list is a small add if a
   distribution should only ever pay a fixed set.
2. **Graded transfer approval.** `requireApprovalForTransfers` is all-or-nothing
   (every transfer → human queue). A value band (auto ≤ $X, approve ≤ $Y, block
   > $Y) maps perfectly onto payouts and is a small rule addition.

## Two ways to integrate

1. **This skill pack** — edit-in-prompt; insert the GATE curl into the SKILL.md.
   Zero code dependency.
2. **MandateSeal MCP server** (`/api/mcp`) — since Aeon agents run on Claude,
   expose a guarded transfer as an MCP tool the skill must call. Enforcement
   lives at the tool layer, not in a prompt that can be edited.
