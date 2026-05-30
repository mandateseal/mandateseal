# FeeVault + fee-gate — design (W9)

> Status: **draft / scoping.** No code or contract committed yet. This is the
> architecture for the token utility that lands with the bankr.bot launch (W10):
> *flip public + utility in one moment.*

## Goal

Give the token a real, usage-linked utility: **paid MandateSeal actions require
the action's owner to have an active on-chain entitlement.** Token demand grows
with product usage, and the flow is trustless on the value side (a contract
holds funds, not us) while staying fast on the hot path (no on-chain tx per
`/api/check`).

Two pieces:
1. **FeeVault** — a Base contract that takes the token and records entitlement.
2. **fee-gate** — a MandateSeal policy layer that reads entitlement and gates
   paid actions, mirroring how `enforceDailyBudget` gates on a DB aggregate.

## Decisions locked (2026-05-30)

- **Gating model: prepaid credits** (§2) — deposit token → off-chain credits →
  metered per paid action.
- **Free/paid boundary: quota + features** (§1) — free daily check quota +
  testnet anchor + verify; paid = beyond quota + mainnet anchor + MCP +
  reputation.
- Still open: credit unit (§8.2), holder bypass (§8.3), treasury governance
  (§8.4), token address (§8.5).

---

## 1. What gets gated (free vs paid)

The gate must not break the free demo / evaluation path (that's our funnel).
Proposed boundary:

| Tier | Included | Gated behind entitlement |
|---|---|---|
| **Free** | `/api/check` up to a daily quota (e.g. 100/day/agent), testnet (Base Sepolia) anchoring, public receipts, verify | — |
| **Paid** | `/api/check` beyond the free quota, **mainnet** anchoring, MCP server access, agent reputation / private dashboards | requires active entitlement |

`/api/verify` stays public forever (proof must be free to check — that's the
product's whole promise). The gate only ever touches the *write/decision* path,
never verification.

---

## 2. Gating model

Three candidates; recommendation first.

### ✅ Recommended: prepaid credits ("vault" in the literal sense)

- User deposits the token into **FeeVault** → FeeVault holds it (treasury) and
  emits `Deposited(owner, amount)`.
- MandateSeal indexes `Deposited` → adds off-chain **credits** to that owner.
- Each paid action decrements credits off-chain (fast, no tx). At zero → the
  fee-gate BLOCKS until the owner deposits more.
- **Why:** real token sink (tokens flow into treasury as usage grows), demand
  scales with usage, and "FeeVault" is literally a vault of deposited funds.
  Deposit is on-chain (trustless value custody); metering is off-chain (fast).

### Alt A — hold-to-access (balance gate)

- Entitled iff `token.balanceOf(owner) >= threshold`. No deposit, no custody,
  no FeeVault state (just reads the ERC-20).
- Simplest to ship, creates holding demand, but **no revenue / no sink** and a
  single whale wallet could gate many agents unless bound 1:1.
- Good as a *launch-day fallback* if credits aren't ready; weak as the endgame.

### Alt B — subscription (time-boxed)

- `subscribe(periods)` pays `periodFee * periods` → `expiry` extended. Entitled
  while `now < expiry`.
- Clean UX + recurring demand, but coarser than per-use and less tied to value
  delivered.

> **Plan:** ship **prepaid credits** as the core. Optionally honor hold-to-access
> as a *bypass* ("holders of ≥ N never hit the gate") if we want a holder perk —
> that's a one-line OR in the entitlement check, decided later.

---

## 3. FeeVault contract (Base)

Minimal surface. Holds the token, records deposits, lets a treasury withdraw.
No per-check writes — consumption is metered off-chain against deposited credit.

```solidity
interface IFeeVault {
    // Pull `amount` of the token from msg.sender into the vault, credit `owner`.
    // `owner` may differ from msg.sender (lets a funder top up an agent owner).
    function deposit(address owner, uint256 amount) external;

    // Lifetime deposited per owner (MandateSeal reconciles credits against this).
    function depositedOf(address owner) external view returns (uint256);

    // Treasury controls (multisig / DAO later). Withdraw accumulated fees.
    function withdraw(address to, uint256 amount) external; // onlyTreasury

    event Deposited(address indexed owner, address indexed from, uint256 amount, uint256 lifetime);
    event Withdrawn(address indexed to, uint256 amount);
}
```

Notes
- **Token-agnostic at deploy** — constructor takes the ERC-20 address, so the
  bankr.bot token address is wired in once it exists (decouples contract work
  from the launch).
- `deposit(owner, amount)` keyed on a chosen `owner` address means a third party
  (or bankr flow) can fund an agent's entitlement.
- No refund/withdraw-by-user in v1 (prepaid, non-custodial-return). Revisit if we
  want credit refunds — adds complexity + abuse surface.
- Pausable + treasury-owned; standard OZ `Ownable`/`Pausable`.

---

## 4. Wallet binding (the security crux)

Entitlement is keyed on an **owner wallet**. The mandate already has an
`ownerWallet` field — but today it's unverified, so anyone could claim a whale's
address. Before fee-gate ships, `ownerWallet` MUST be **proven**:

- Owner signs a nonce (EIP-191 / SIWE-style) → MandateSeal verifies the
  signature recovers `ownerWallet` → marks the binding verified.
- Only a **verified** `ownerWallet` is used for entitlement lookups.
- New endpoint: `POST /api/agents/:id/verify-wallet` (challenge → signature).

Without this, the gate is trivially bypassable. This is a hard prerequisite, not
a nice-to-have.

---

## 5. MandateSeal integration

### 5a. Entitlement service (`src/lib/entitlement.ts`)

- An **indexer** subscribes to FeeVault `Deposited` events (Base RPC, e.g.
  Alchemy) and maintains an off-chain ledger: `creditsRemaining(owner)` =
  `lifetimeDeposited(owner) * creditsPerToken − consumed(owner)`.
- `consumed(owner)` increments when a paid action is APPROVED (metered).
- Cache entitlement in the DB (`Entitlement` table: owner, lifetimeDeposited,
  consumed, updatedAt) so the hot path is a single indexed DB read, not an RPC
  call. Reconcile against chain on a short interval + on each `Deposited` event.

### 5b. New policy step (post-engine, mirrors `enforceDailyBudget`)

In `evaluateAndSeal`, after the daily-budget / token-spend blocks:

```
if (decision APPROVED && action is "paid" && feeGateEnabled) {
  const owner = verifiedOwnerWallet(mandate);
  const ent   = await getEntitlement(owner);   // DB read, cached
  decision = enforceFeeGate(decision, action, ent);  // pure fn
  if (decision APPROVED) await meterUsage(owner, action); // decrement credits
}
```

- `enforceFeeGate` is a **pure function** (like `enforceDailyBudget` /
  `enforceDailyTokenSpend`) → trivially unit-testable, no chain in tests.
- Block reason is explicit + actionable: `feeGate: no active entitlement —
  deposit $TOKEN to FeeVault` with `matchedRule: "feeGate.insufficientCredits"`.
- "paid" = `costUsd > 0` OR a premium feature flag (mainnet anchor / MCP). Free
  daily quota handled exactly like the existing per-tool quota counter.

Decision enum stays `APPROVED | BLOCKED | NEEDS_APPROVAL` — fee-gate failure maps
to **BLOCKED** (the receipt still gets signed, so "you were blocked for non-payment
at time T" is itself provable — on-brand).

### 5c. Metering & idempotency

- Meter only on APPROVED paid actions. Reuse the v0.8.1 `Idempotency-Key` so a
  retried check never double-charges credits.

---

## 6. Token / treasury flow

```
bankr.bot launch ──> $TOKEN (Base)
        │
   user buys/holds
        │  deposit(owner, amount)
        ▼
   ┌──────────┐   Deposited event    ┌───────────────────┐
   │ FeeVault │ ───────────────────► │ MandateSeal indexer│→ credits(owner)
   │ (treasury)│                      └───────────────────┘
   └──────────┘                                │
        ▲                                       │ each paid /api/check
        │ withdraw (multisig)                   ▼  decrements credits
   ops / buyback-burn                     fee-gate enforce
```

Treasury policy (fees collected) — ops runway / buyback-burn / LP — is a
tokenomics decision, out of scope for this doc but worth deciding before W10.

---

## 7. Phasing

| Phase | Scope | Blocks on |
|---|---|---|
| **P0 (now)** | This design + `enforceFeeGate` pure fn + `Entitlement` schema + wallet-verify endpoint, all behind `FEE_GATE_ENABLED=false` | nothing (solo) |
| **P1** | FeeVault contract + tests on **Base Sepolia**; indexer; e2e on testnet | testnet RPC |
| **P2 (W3-4 dep)** | Deploy FeeVault on **Base mainnet**, wire real token address | mainnet wallet + token |
| **P3 (W10)** | Flip `FEE_GATE_ENABLED=true` at launch — utility live "in one moment" | token live on bankr.bot |

P0 is fully buildable now and ships dark (flag off) → zero risk to the live site,
and makes the launch a one-flag flip.

---

## 8. Open decisions (need product/tokenomics calls)

1. **Free/paid boundary** — is the free tier a daily check quota, or feature-based
   (mainnet anchor + MCP = paid, everything else free)? (rec: quota + features)
2. **Credit unit** — credits per check (flat) vs weighted by `costUsd`/risk?
   (rec: flat per paid check for v1 simplicity)
3. **Hold-to-access bypass** — do token *holders* (≥ N) skip the gate as a perk,
   or is it strictly prepaid credits? (rec: prepaid only for v1)
4. **Treasury governance** — EOA → multisig → DAO timeline.
5. **Token decimals/address** — wired at FeeVault deploy once bankr.bot mints it.
