# Multi-tenant dashboard — design ($SEAL-gated)

> Status: **draft / scoping.** No code yet. The token utility: $SEAL holders get
> their OWN scoped dashboard — create + manage their own agents/mandates, see
> their own receipts. NOT god-mode (today's dashboard) opened to everyone.

## Goal / non-goals

**Goal:** a holder signs in with their wallet (SIWE) + proves they hold ≥ N
$SEAL → gets a dashboard scoped to **only their own** agents/mandates/receipts.
Self-serve: they create agents (get a scoped API key), set mandates, view their
receipts.

**Non-goals (holders never get these):** anchor broadcast (spends our gas),
other tenants' data, tools/webhooks/audit ops, deleting anything they don't own.
Those stay **admin-only** (existing `MANDATESEAL_ADMIN_ADDRESSES` god-mode).

> Security crux: a single missed scope filter = cross-tenant data leak. That's
> the exact "trust the log" promise we'd be breaking. Enforcement must live at
> ONE chokepoint, and be tested exhaustively.

## 1. Tenancy model

- Add `ownerWallet String?` to **Agent** (the tenant key — the holder who owns it).
- Mandates + Receipts inherit tenancy through their `agentId` (an agent's owner
  owns its mandates/receipts). No direct ownerWallet on those (derive via agent).
- Legacy/demo agents (Atlas-01 etc.): `ownerWallet = null` → **admin-only**,
  never visible to any holder. Migration is additive + safe.

## 2. Auth — two session roles

Extend the session (today: opaque HMAC token, identity-less) to carry
`{ role: "admin" | "holder", wallet }`, HMAC-signed (no server state, like now).

- **Admin login** (unchanged): SIWE, address ∈ `MANDATESEAL_ADMIN_ADDRESSES` →
  `role=admin` session → god-mode (existing behavior).
- **Holder login** (new): SIWE → recovered address → check on-chain
  `$SEAL.balanceOf(addr) ≥ MIN_SEAL_BALANCE` (reuse viem, like `feevault.ts`) →
  `role=holder, wallet=addr` session → scoped to that wallet.
- New route `POST /api/auth/holder` (SIWE verify + balance gate). `/api/auth/siwe`
  stays the admin path.

## 3. Scoping chokepoint (the security core)

One helper resolves the caller's scope from the session, used by EVERY dashboard
read/write:

```
scopeFilter(session):
  role=admin  → {}                            // sees all
  role=holder → { agent: { ownerWallet: session.wallet } }  // only own
```

- Reads: `prisma.agent.findMany({ where: scopeFilter })`, mandates/receipts via
  `{ agent: { ownerWallet } }`.
- Writes/mutations: load the target, assert its (derived) ownerWallet ===
  session.wallet (or role=admin), else 403.
- Implemented as a tiny lib (`src/lib/tenant.ts`) so no route hand-rolls it.

## 4. What a holder can do

| Action | Holder | Admin |
|---|---|---|
| Create agent (own) + get scoped API key | ✅ | ✅ |
| Create/edit/delete own mandate | ✅ | ✅ (any) |
| View own receipts / spend | ✅ | ✅ (all) |
| Anchor broadcast, tools, webhooks, audit | ❌ | ✅ |
| See another tenant's anything | ❌ | ✅ |

Optional limit: `MAX_AGENTS_PER_HOLDER` (anti-abuse).

## 5. Surfaces to change

- **Middleware**: holder sessions may reach the scoped pages/APIs; anchor/tools/
  webhooks/audit stay admin-only (extend the role check).
- **Every `/api/{agents,mandates,receipts}` handler**: apply `scopeFilter` +
  ownership assert on mutations.
- **Agent create**: stamp `ownerWallet` = session.wallet for holders.
- **Dashboard pages**: filtered queries; hide admin-only nav for holders.

## 6. $SEAL gate

- `MIN_SEAL_BALANCE` (env) — minimum $SEAL to access. Read via viem
  `balanceOf` on Base mainnet ($SEAL `0x0590…9BA3`). Cache briefly per address.
- Re-check on login; optionally re-check periodically (a holder who sells below
  the threshold loses access on next login).

## 7. Migration

`ALTER TABLE "Agent" ADD COLUMN "ownerWallet" TEXT;` (nullable, additive).
Backfill: existing agents stay `null` = admin-only. Safe; no behavior change
until holder login ships.

## 8. Phasing

| Phase | Scope | Risk |
|---|---|---|
| **P0** | schema (`Agent.ownerWallet`) + `scopeFilter` lib + holder session ({role,wallet}) + `/api/auth/holder` ($SEAL gate) + scope the 3 read APIs (agents/mandates/receipts). Behind `MULTITENANT_ENABLED` flag. | medium |
| **P1** | self-serve agent create (scoped key) + mandate CRUD scoped + ownership asserts on all mutations. | high (mutation scoping) |
| **P2** | dashboard UI (holder login, scoped pages, hide admin nav) + `MIN_SEAL_BALANCE` tuning + agent caps. | medium |

P0 ships dark (flag off) → zero impact on the live admin dashboard.

## 9. Open decisions

1. **`MIN_SEAL_BALANCE`** — how much $SEAL to access? (tokenomics)
2. **Per-holder agent cap** — unlimited vs `MAX_AGENTS_PER_HOLDER`.
3. **Holder API keys** — one per agent (as today) — confirm scoping of the key
   to the owner.
4. **Below-threshold holders** — lose access immediately (every request re-check)
   vs at next login (cheaper). (rec: at login + periodic, not per-request)
