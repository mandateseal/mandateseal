# Mainnet anchor flip — runbook (W3-4)

> Goal: move onchain anchoring from **Base Sepolia** (testnet) to **Base mainnet**.
> Anchor-only — no fee-gate, no token (that's W9). The anchoring code is already
> chain-agnostic (`src/lib/onchain.ts`), so this is an **ops flip + a funded
> wallet**, not a code change.

## What's already done (no work)

- `onchain.ts` supports `base` and `base-sepolia` purely via env.
- Receipt anchor links derive the explorer from each batch's stored `chain`
  (`AnchorClient.tsx`), so existing testnet batches keep linking to
  `sepolia.basescan.org` while new mainnet batches link to `basescan.org`.
- Playground copy is chain-neutral ("broadcast onchain to Base").

## Prerequisites (needs you)

1. A **fresh signer wallet** (don't reuse the receipt-signing Ed25519 key — this
   is a separate EVM key just for broadcasting anchor txs).
2. A little **ETH on Base mainnet** in that wallet. Anchor txs are 0-value
   self-transfers with 72 bytes of calldata — cheap; a fraction of an ETH lasts
   a long time.
3. A **Base mainnet RPC URL** (e.g. Alchemy/Infura/`https://mainnet.base.org`).

## Steps

1. **Preflight (read-only, no tx).** Validate config + RPC + signer gas before
   touching prod:
   ```bash
   MANDATESEAL_ANCHOR_CHAIN=base \
   MANDATESEAL_ANCHOR_RPC_URL=<base-mainnet-rpc> \
   MANDATESEAL_ANCHOR_PRIVATE_KEY=0x<signer-key> \
     node scripts/anchor-preflight.mjs
   ```
   Must print **✓ ready to flip**. It checks: config parses, RPC reachable,
   `chainId == 8453`, signer derives, signer has gas.

2. **Set the three vars on Vercel** (Production env):
   `MANDATESEAL_ANCHOR_CHAIN=base`, `MANDATESEAL_ANCHOR_RPC_URL`,
   `MANDATESEAL_ANCHOR_PRIVATE_KEY`.

3. **Redeploy** (env change triggers it, or `vercel --prod`).

4. **Trigger the next anchor batch** (anchor dashboard / broadcast endpoint).
   It now broadcasts to Base mainnet.

5. **Verify**: open the receipt's anchor link (auto-points to `basescan.org`),
   or `POST /api/anchor/:id/verify-onchain` — confirm the MS01 calldata matches
   the batch root.

6. **Doc updates at flip** (do these only after the first mainnet anchor lands):
   - README top-of-fold: "Base Sepolia anchor link" → "Base anchor link".
   - LAUNCH.md: leave the historical Sepolia tx links as-is (they're real
     testnet-era records); add a note that mainnet anchoring is now live.

## Safety / rollback

- **Existing testnet batches stay valid** — `chain` is stored per batch, so old
  receipts keep verifying against Sepolia. Only NEW batches go to mainnet.
- **Rollback**: set `MANDATESEAL_ANCHOR_CHAIN=base-sepolia` (+ testnet RPC/key)
  and redeploy. No data migration; anchoring is stateless per batch.
- The signer key is broadcast-only; if leaked, an attacker can only spend its
  gas (drain ETH) — rotate by swapping the env var. It cannot forge receipts
  (those are Ed25519-signed server-side, separate key).
