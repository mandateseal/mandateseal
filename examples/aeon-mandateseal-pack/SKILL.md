# distribute-tokens (MandateSeal-guarded)

Pay a list of contributors via the Bankr Wallet API — but route every transfer
through a MandateSeal **mandate** first, and seal a verifiable **receipt** for
every decision. A drop-in variant of Aeon's `distribute-tokens`: same Bankr
execution, same idempotency discipline, with an external permission + proof
layer the agent cannot talk its way around.

> Autonomy stays. The money-moving path becomes bounded, gated, and provable.

## What changes vs. stock distribute-tokens

One phase is inserted — **GATE** — between RESOLVE and EXECUTE. Nothing else
about the skill's behaviour changes.

```
RESOLVE  validate config, balances, resolve handles → addresses
   │
   ▼
GATE     for each READY row: POST {MANDATESEAL_URL}/api/check   ◄── new
   │       APPROVED        → row proceeds to EXECUTE
   │       BLOCKED         → drop row, log the matched rule
   │       NEEDS_APPROVAL  → hold row; resolve in the MandateSeal dashboard
   ▼
EXECUTE   POST api.bankr.bot/wallet/transfer for APPROVED rows only
   │
   ▼
SEAL     each decision already returned a signed receipt; persist its id
```

## Secrets

- `BANKR_API_KEY` — Bankr API key (`bk_...`), read-write, Wallet API enabled. (unchanged)
- `MANDATESEAL_API_KEY` — MandateSeal agent key (`msk_...`).
- `MANDATESEAL_URL` — MandateSeal base URL (self-hosted or hosted instance).

## Config

`memory/distributions.yml` is unchanged from stock distribute-tokens. The caps
now live in the **mandate** on the MandateSeal side (set once by the operator),
not in the skill — so the agent that writes the distribution config cannot also
raise its own limits.

## GATE phase — the one call

For each `READY` row, before sending:

```bash
curl -sS -X POST "$MANDATESEAL_URL/api/check" \
  -H "Authorization: Bearer $MANDATESEAL_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: aeon-payout-${LIST}-${RECIPIENT}-${DATE_UTC}" \
  -d '{
    "agentId": "'"$AGENT_ID"'",
    "actionType": "transfer_usdc",
    "tool": "bankr",
    "target": "'"$RECIPIENT"'",
    "costUsd": 0,
    "chain": "base",
    "token": "USDC",
    "amount": "'"$AMOUNT_BASE_UNITS"'",
    "txValueUsd": '"$VALUE_USD"',
    "recipient": "'"$RECIPIENT"'"
  }'
```

Response: `{ decision, matchedRule, reason, riskLevel, receipt }`.

- `decision == "APPROVED"` → proceed to the Bankr transfer for this row.
- `decision == "BLOCKED"` → skip the row; log `matchedRule` + `reason`.
- `decision == "NEEDS_APPROVAL"` → skip for this run; a human resolves it in the
  MandateSeal dashboard (the response includes an `approval` handle).

The `Idempotency-Key` is keyed on `(list, recipient, UTC date)` — the same
discipline stock distribute-tokens uses for its local state file, now enforced
server-side so a retried batch is safe even across machines.

## What the mandate enforces (set by the operator, once)

| Guard | Mandate field | Engine rule |
|---|---|---|
| Allowed chains (Base only) | `allowedChains` | C3 |
| Allowed tokens (USDC/ETH) | `allowedTokens` | C4 |
| Per-transfer USD ceiling | `maxTxValueUsd` | C5 |
| Never-pay recipients | `blockedRecipients` | C1 |
| Route every payout to a human | `requireApprovalForTransfers` | C9 |
| Safe batch retries | `Idempotency-Key` | v0.8.1 |

Every decision — APPROVED, BLOCKED, or NEEDS_APPROVAL — is Ed25519-signed and
merkle-anchored, so a contributor (or an auditor) can later verify exactly what
was authorized, when, and against which policy.

## Dry run

`dry-run:LABEL` previews the full plan **including each GATE decision** without
sending any Bankr transfer — identical to stock distribute-tokens, plus the
policy verdicts.

## Try it locally

A runnable, fully-local demo of this flow (offline by default, no funds moved):

```
node examples/aeon-distribute-guarded.mjs
```
