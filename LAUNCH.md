# MandateSeal — Launch Kit

Launch is **Farcaster-first**, Bankr-aware. The audience is people building or
trusting autonomous crypto agents — bots that hold wallets, trade, swap, vote,
and (today) operate on pure prompt-faith.

The narrative: **Bankr executes. MandateSeal proves what was allowed to execute.**
The two are paired, not competing.

Order of operations:
1. Cast the launch on Farcaster.
2. Reply-cast to @bankr with the playground link.
3. Mirror to X (Twitter) as the secondary channel.
4. Drop in `/r/LocalLLaMA`, ai16z dev channel, Virtuals discord.
5. PR the MCP server registry.
6. Show HN last — it's the "developer crowd" beat, comes after the crypto audience hooks first.

---

## Primary: Farcaster launch cast

> 🔏 launching mandateseal — permission + proof layer for autonomous crypto agents.
>
> @bankr executes. mandateseal proves what was *allowed* to execute.
>
> every agent action is checked against a wallet mandate (allowed chains / tokens / contracts, blocked recipients, tx caps, infinite-approval = blocked). receipt is Ed25519-signed, merkle-batched, anchored to base.
>
> play (scripted agent runs 8 onchain actions live):
> https://mandateseal.tech/playground
>
> docs:
> https://mandateseal.tech/docs

**Reply cast** (chain it under your own launch cast):

> if you're running an onchain agent — bankr-driven or your own — point your MCP client at:
>
> https://mandateseal.tech/api/mcp
>
> every tools/call now produces a preflight + outcome receipt. drainer txs blocked at the policy layer, not at the wallet.

**Optional follow-up cast** (post 24h later if traction):

> first 32 sealed receipts on mandateseal.
>
> 3 approved (USDC transfer 25, approve $1, DAO vote)
> 4 blocked (blocked recipient, infinite approval, off-list contract, unsupported chain)
> 1 needs human (token swap to unknown DEX)
>
> all 32 anchored to base sepolia in 1 batch:
> https://sepolia.basescan.org/tx/0xc685256d59821c539d4fe38e20c76f58b86e3d82fb259ebd1542cc212ff45448
>
> drainer txs aren't a model-safety problem. they're a permission problem.

---

## X / Twitter (secondary, condensed)

> 🔏 launching MandateSeal — permission and proof layer for autonomous crypto agents.
>
> Bankr-style execution gets a sister tool: a mandate the agent can't talk its way around, and a sealed receipt every action leaves behind. Both verifiable from base.
>
> https://mandateseal.tech/playground

**Thread variant** (5 tweets, condensed):

> 1/ 🔏 MandateSeal — every onchain agent action gets a wallet-mandate check *before* it runs, and an Ed25519-signed receipt *after*.
>
> Built it because every "AI agent with a wallet" is one prompt-injection away from a drainer. "trust the LLM" is not a strategy.
>
> https://mandateseal.tech

> 2/ The mandate maps to how agents actually fail:
>
> ✅ allowedChains, allowedTokens, allowedContracts
> ✅ blockedRecipients (known drainers), blockedContracts
> ✅ maxTxValueUsd, dailyTokenSpendUsd
> ✅ requireApprovalForSwaps / Transfers
> ✅ infinite token approvals → BLOCKED outright
> ✅ unknown contract selectors → NEEDS_APPROVAL

> 3/ Receipts get merkle-batched and broadcast to Base. Anyone can fetch the tx, slice the calldata, and recompute the proof.
>
> No MandateSeal contact required.
>
> Latest batch (21 receipts):
> https://sepolia.basescan.org/tx/0xc685256d59821c539d4fe38e20c76f58b86e3d82fb259ebd1542cc212ff45448

> 4/ Also an MCP server. Point Claude Desktop / Code / Cursor at /api/mcp — every tools/call gets sealed.
>
> The agent's actions become a public, verifiable trail without giving up the model autonomy.

> 5/ Try it cold (zero setup):
> https://mandateseal.tech/playground
>
> 🔏 approve before. prove after.

---

## /r/LocalLLaMA, ai16z, Virtuals (community drops)

Short, no preamble:

> built mandateseal — a permission + proof layer for autonomous crypto agents. wallet mandate before each action, signed receipt after, merkle-anchored to base.
>
> also an MCP server. plug claude code / cursor in: https://mandateseal.tech/api/mcp
>
> playground: https://mandateseal.tech/playground

---

## MCP server registry entry

For PR against [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers):

```yaml
- name: MandateSeal
  description: |
    Permission and proof layer for autonomous crypto agents.
    Every tools/call is gated by a wallet mandate and produces two
    Ed25519-signed receipts (preflight + outcome), merkle-anchored to Base.
  url: https://mandateseal.tech/api/mcp
  transport: streamable-http
  auth: bearer
  source: https://github.com/mandateseal/mandateseal
  category: security
  language: TypeScript
```

Sample `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mandateseal": {
      "transport": "http",
      "url": "https://mandateseal.tech/api/mcp",
      "headers": {
        "Authorization": "Bearer msk_..."
      }
    }
  }
}
```

---

## Show HN (later, after crypto audience hits)

Title: **Show HN: MandateSeal — Permission and proof layer for autonomous crypto agents**

Body:

```
Hey HN — every "AI agent with a wallet" project I saw was one prompt-injection
away from a drainer. The fix pattern always devolved into "trust the LLM."

MandateSeal is a gateway that sits between the agent and the chain. Before any
onchain action the agent presents it; the mandate engine returns
APPROVED / BLOCKED / NEEDS_APPROVAL with a signed receipt. Receipts get
merkle-batched and broadcast to Base, so anyone can verify what the agent
was allowed to do without trusting MandateSeal itself.

Stack: Next.js 14 + Postgres + Ed25519 + viem. ~150 unit tests. Open source.

What's there:
- Wallet mandates (chains, tokens, contracts, recipients, tx caps,
  approval gates, infinite-approval blocked outright)
- Onchain anchors on Base Sepolia (live; 4 batches anchored)
- MCP server adapter — Claude Desktop / Claude Code / Cursor connect
  directly, every tool call sealed
- Public receipt explorer with dynamic 1200×630 OG image per receipt
- Agent reputation scoring
- Idempotency / replay protection, rate limiting, per-tool quotas,
  SIWE wallet auth for the dashboard

What's NOT there:
- Token / coin (deliberately deferred until PMF visible)
- Multi-tenant workspaces (v1.0)
- MandateSeal-signed tx broadcasting (caller still signs)
- Solidity verifier contract

Live: https://mandateseal.tech
Playground (zero setup): https://mandateseal.tech/playground
Repo: https://github.com/mandateseal/mandateseal

Happy to answer questions on the policy engine, receipt format,
MCP integration, or why token-launch-first is the wrong order
for trust infra.
```

---

## Launch checklist

**Pre-flight** (do all of these green before pressing publish anywhere):

```bash
curl -s https://mandateseal.tech                            # 200
curl -s https://mandateseal.tech/api/key.pub                # 200, returns Ed25519 PEM
curl -s https://mandateseal.tech/api/mcp                    # 200 health JSON
curl -s -o /dev/null -w "%{http_code}\n" https://mandateseal.tech/playground          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mandateseal.tech/docs                # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mandateseal.tech/a/agent_atlas_01    # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mandateseal.tech/r/rct_443d72ab67197428732c                  # 200
curl -s -o /dev/null -w "%{http_code}\n" https://mandateseal.tech/r/rct_443d72ab67197428732c/opengraph-image  # 200 (image/png)
```

**Order of operations (Farcaster-first):**

1. ☐ Cast the Farcaster launch (block above).
2. ☐ Reply-cast with @bankr mention + playground link.
3. ☐ Pin both casts on your Farcaster profile.
4. ☐ X primary tweet (single, condensed).
5. ☐ X thread (5-tweet variant) under the primary as a reply chain.
6. ☐ Drop the short community pitch in: r/LocalLLaMA, ai16z dev channel,
     Virtuals discord, Bittensor subnet operators forum.
7. ☐ PR against modelcontextprotocol/servers with the registry entry.
8. ☐ Wait ~24h. If Farcaster + X picked up traction:
     - cast follow-up with concrete numbers (32 receipts, batch anchor link)
     - submit Show HN
9. ☐ Reply to every serious question with a link to the matching
     /docs section, not retyped.

**Token positioning when asked:**

The pitch when someone asks "are you launching a token?":

> Not yet — bankr already has execution-side fee gating, and the trust
> layer needs to earn an audit trail before it earns an economic layer.
> Once mandateseal has visible adoption, the natural token utility is
> paying for anchor gas + per-receipt fees, with the bankr fee gate as
> the primary access path. Two-product story, one economy.
